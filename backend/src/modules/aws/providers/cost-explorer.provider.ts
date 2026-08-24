// AWS Cost Explorer Provider
import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand, Granularity } from "@aws-sdk/client-cost-explorer";
import { getClientConfig, COST_EXPLORER_REGION } from "./client-factory";

export async function getMonthToDateCost(workspaceId: string, roleArn?: string, externalId?: string) {
    const clientConfig = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(clientConfig);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Use proper Date arithmetic to avoid "32" on the 31st
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const end = tomorrow.toISOString().split("T")[0];
    const start = `${year}-${month}-01`;

    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: Granularity.DAILY,
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }]
    });

    const response = await client.send(command);

    // Aggregate across all days in the response
    const serviceMap = new Map<string, { amount: number, unit: string }>();
    response.ResultsByTime?.forEach(result => {
        result.Groups?.forEach(group => {
            const svc = group.Keys?.[0] || "Other";
            const amt = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
            const unit = group.Metrics?.UnblendedCost?.Unit || "USD";
            const existing = serviceMap.get(svc) || { amount: 0, unit };
            existing.amount += amt;
            serviceMap.set(svc, existing);
        });
    });

    const breakdown = Array.from(serviceMap.entries()).map(([service, val]) => ({
        service,
        amount: Math.round(val.amount * 100) / 100,
        unit: val.unit
    })).sort((a, b) => b.amount - a.amount);

    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
    return { total, unit: breakdown[0]?.unit || "USD", breakdown, period: { start, end } };
}

export async function getCostByPeriod(workspaceId: string, days: number = 7, roleArn?: string, externalId?: string) {
    const clientConfig = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(clientConfig);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const end = tomorrow.toISOString().split("T")[0];

    // Start date: 'days' ago
    const startObj = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const startYear = startObj.getFullYear();
    const startMonth = String(startObj.getMonth() + 1).padStart(2, "0");
    const startDay = String(startObj.getDate()).padStart(2, "0");
    const start = `${startYear}-${startMonth}-${startDay}`;

    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: Granularity.DAILY,
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }]
    });

    const response = await client.send(command);

    const serviceMap = new Map<string, { amount: number, unit: string }>();
    response.ResultsByTime?.forEach(result => {
        result.Groups?.forEach(group => {
            const svc = group.Keys?.[0] || "Other";
            const amt = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
            const unit = group.Metrics?.UnblendedCost?.Unit || "USD";
            const existing = serviceMap.get(svc) || { amount: 0, unit };
            existing.amount += amt;
            serviceMap.set(svc, existing);
        });
    });

    const breakdown = Array.from(serviceMap.entries()).map(([service, val]) => ({
        service,
        amount: Math.round(val.amount * 100) / 100,
        unit: val.unit
    })).sort((a, b) => b.amount - a.amount);

    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
    return { total, unit: breakdown[0]?.unit || "USD", breakdown, period: { start, end } };
}

export async function getCostTrend(workspaceId: string, days: number = 30, roleArn?: string, externalId?: string) {
    const clientConfig = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(clientConfig);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const end = tomorrow.toISOString().split("T")[0];

    const startObj = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const startYear = startObj.getFullYear();
    const startMonth = String(startObj.getMonth() + 1).padStart(2, "0");
    const startDay = String(startObj.getDate()).padStart(2, "0");
    const start = `${startYear}-${startMonth}-${startDay}`;

    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: Granularity.DAILY,
        Metrics: ["UnblendedCost"]
    });

    const response = await client.send(command);
    return response.ResultsByTime?.map(result => {
        const rawAmount = parseFloat(result.Total?.UnblendedCost?.Amount || "0");
        return {
            date: result.TimePeriod?.Start,
            amount: Math.round(rawAmount * 100) / 100,
            unit: result.Total?.UnblendedCost?.Unit || "USD"
        };
    }) || [];
}

export async function getCostForecast(workspaceId: string, roleArn?: string, externalId?: string) {
    const clientConfig = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(clientConfig);

    const now = new Date();
    // Use the first day of next month as the exclusive end date to cover the full current month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfPeriod = nextMonth.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    try {
        const command = new GetCostForecastCommand({
            TimePeriod: { Start: tomorrow, End: endOfPeriod },
            Metric: "UNBLENDED_COST",
            Granularity: Granularity.MONTHLY
        });
        const response = await client.send(command);
        const rawAmount = parseFloat(response.Total?.Amount || "0");
        return {
            amount: Math.round(rawAmount * 100) / 100,
            unit: response.Total?.Unit || "USD"
        };
    } catch {
        return null;
    }
}

// ─── Cost Breakdown by Pricing Model (On-Demand vs RI vs Spot vs Savings Plan) ───
export async function getCostByPricingModel(workspaceId: string, days: number = 30, roleArn?: string, externalId?: string) {
    const clientConfig = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(clientConfig);

    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: Granularity.MONTHLY,
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "PURCHASE_TYPE" }],
    });

    const response = await client.send(command);
    const breakdown: Record<string, number> = {};
    let total = 0;

    for (const period of response.ResultsByTime || []) {
        for (const group of period.Groups || []) {
            const purchaseType = group.Keys?.[0] || "Other";
            const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
            breakdown[purchaseType] = (breakdown[purchaseType] || 0) + amount;
            total += amount;
        }
    }

    // Normalize keys to consistent naming
    const normalized = {
        onDemand: breakdown["On Demand Instances"] || breakdown["On-Demand"] || 0,
        reserved: breakdown["Reserved Instances"] || breakdown["Reserved"] || 0,
        spot: breakdown["Spot Instances"] || breakdown["Spot"] || 0,
        savingsPlan: breakdown["Savings Plans"] || breakdown["SavingsPlan"] || 0,
        other: 0 as number,
        total,
    };
    normalized.other = total - normalized.onDemand - normalized.reserved - normalized.spot - normalized.savingsPlan;

    return {
        breakdown: normalized,
        percentages: {
            onDemand: total > 0 ? Math.round((normalized.onDemand / total) * 10000) / 100 : 0,
            reserved: total > 0 ? Math.round((normalized.reserved / total) * 10000) / 100 : 0,
            spot: total > 0 ? Math.round((normalized.spot / total) * 10000) / 100 : 0,
            savingsPlan: total > 0 ? Math.round((normalized.savingsPlan / total) * 10000) / 100 : 0,
        },
        period: { start, end },
    };
}

// ─── Reserved Instance Purchase Recommendation ───
export async function getRIPurchaseRecommendation(workspaceId: string, service: string = "Amazon Elastic Compute Cloud - Compute", roleArn?: string, externalId?: string) {
    const { GetReservationPurchaseRecommendationCommand } = await import("@aws-sdk/client-cost-explorer");
    const clientConfig = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(clientConfig);

    try {
        const command = new GetReservationPurchaseRecommendationCommand({
            Service: service,
            LookbackPeriodInDays: "THIRTY_DAYS",
            TermInYears: "ONE_YEAR",
            PaymentOption: "NO_UPFRONT",
        });

        const response = await client.send(command);
        const recommendations = (response.Recommendations || []).flatMap((rec) =>
            (rec.RecommendationDetails || []).map((detail) => ({
                instanceType: detail.InstanceDetails?.EC2InstanceDetails?.InstanceType || "unknown",
                region: detail.InstanceDetails?.EC2InstanceDetails?.Region || "unknown",
                family: detail.InstanceDetails?.EC2InstanceDetails?.Family || "unknown",
                recommendedCount: parseInt(detail.RecommendedNumberOfInstancesToPurchase || "0", 10),
                estimatedMonthlySavings: parseFloat(detail.EstimatedMonthlySavingsAmount || "0"),
                estimatedMonthlyOnDemandCost: parseFloat(detail.AverageNormalizedUnitsUsedPerHour || "0") * 730,
                upfrontCost: parseFloat(detail.UpfrontCost || "0"),
                recurringMonthlyCost: parseFloat(detail.RecurringStandardMonthlyCost || "0"),
                averageUtilization: parseFloat(detail.AverageUtilization || "0"),
            }))
        );

        const totalSavings = recommendations.reduce((s, r) => s + r.estimatedMonthlySavings, 0);

        return { recommendations, totalEstimatedMonthlySavings: totalSavings, service };
    } catch (err) {
        console.warn("[CostExplorer] RI recommendation failed:", err);
        return { recommendations: [], totalEstimatedMonthlySavings: 0, service };
    }
}

// ─── Savings Plan Purchase Recommendation ───
export async function getSavingsPlanRecommendation(workspaceId: string, roleArn?: string, externalId?: string) {
    const { GetSavingsPlansPurchaseRecommendationCommand } = await import("@aws-sdk/client-cost-explorer");
    const clientConfig = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(clientConfig);

    try {
        const command = new GetSavingsPlansPurchaseRecommendationCommand({
            SavingsPlansType: "COMPUTE_SP",
            LookbackPeriodInDays: "THIRTY_DAYS",
            TermInYears: "ONE_YEAR",
            PaymentOption: "NO_UPFRONT",
        });

        const response = await client.send(command);
        const summary = response.SavingsPlansPurchaseRecommendation?.SavingsPlansPurchaseRecommendationSummary;
        const details = response.SavingsPlansPurchaseRecommendation?.SavingsPlansPurchaseRecommendationDetails || [];

        return {
            estimatedMonthlySavings: parseFloat(summary?.EstimatedMonthlySavingsAmount || "0"),
            estimatedSavingsPercentage: parseFloat(summary?.EstimatedSavingsPercentage || "0"),
            recommendedHourlyCommitment: parseFloat(summary?.HourlyCommitmentToPurchase || "0"),
            currentOnDemandSpend: parseFloat(summary?.CurrentOnDemandSpend || "0"),
            details: details.map((d) => ({
                hourlyCommitment: parseFloat(d.HourlyCommitmentToPurchase || "0"),
                estimatedMonthlySavings: parseFloat(d.EstimatedMonthlySavingsAmount || "0"),
                accountId: d.AccountId || "unknown",
                upfrontCost: parseFloat(d.UpfrontCost || "0"),
            })),
        };
    } catch (err) {
        console.warn("[CostExplorer] Savings Plan recommendation failed:", err);
        return {
            estimatedMonthlySavings: 0,
            estimatedSavingsPercentage: 0,
            recommendedHourlyCommitment: 0,
            currentOnDemandSpend: 0,
            details: [],
        };
    }
}
