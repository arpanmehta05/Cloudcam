// AWS Cost Explorer Helpers
import {
    CostExplorerClient,
    GetCostAndUsageCommand,
    GetCostForecastCommand,
    Context,
    Granularity
} from "@aws-sdk/client-cost-explorer";
import { getClientConfig, COST_EXPLORER_REGION } from "./client-factory";

/**
 * Get month-to-date cost breakdown by service.
 */
export async function getMonthToDateCost(
    workspaceId: string,
    roleArn?: string,
    externalId?: string
) {
    const config = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(config);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    // If it's the 1st of the month, we look at last month instead
    const start = firstDayOfMonth === today
        ? new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]
        : firstDayOfMonth;

    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: today },
        Granularity: Granularity.MONTHLY,
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }]
    });

    const response = await client.send(command);

    // Process results into a simpler format
    const costs = response.ResultsByTime?.[0]?.Groups?.map(group => ({
        service: group.Keys?.[0] || "Other",
        amount: parseFloat(group.Metrics?.UnblendedCost?.Amount || "0"),
        unit: group.Metrics?.UnblendedCost?.Unit || "USD"
    })).sort((a, b) => b.amount - a.amount) || [];

    const total = costs.reduce((sum, item) => sum + item.amount, 0);

    return {
        total,
        unit: costs[0]?.unit || "USD",
        breakdown: costs,
        period: { start, end: today }
    };
}

/**
 * Get daily cost trend for the last 30 days.
 */
export async function getCostTrend(
    workspaceId: string,
    days: number = 30,
    roleArn?: string,
    externalId?: string
) {
    const config = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(config);

    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: Granularity.DAILY,
        Metrics: ["UnblendedCost"]
    });

    const response = await client.send(command);

    return response.ResultsByTime?.map(result => ({
        date: result.TimePeriod?.Start,
        amount: parseFloat(result.Total?.UnblendedCost?.Amount || "0"),
        unit: result.Total?.UnblendedCost?.Unit || "USD"
    })) || [];
}

/**
 * Get projected spend for the remainder of the month.
 */
export async function getCostForecast(
    workspaceId: string,
    roleArn?: string,
    externalId?: string
) {
    const config = await getClientConfig(workspaceId, COST_EXPLORER_REGION, roleArn, externalId);
    const client = new CostExplorerClient(config);

    // End of current month
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    try {
        const command = new GetCostForecastCommand({
            TimePeriod: { Start: tomorrow, End: lastDayOfMonth },
            Metric: "UNBLENDED_COST",
            Granularity: Granularity.MONTHLY
        });

        const response = await client.send(command);
        return {
            amount: parseFloat(response.Total?.Amount || "0"),
            unit: response.Total?.Unit || "USD"
        };
    } catch (e) {
        // Forecast can fail if there isn't enough historical data
        return null;
    }
}
