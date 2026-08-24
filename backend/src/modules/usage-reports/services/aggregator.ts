import { getCredentials } from "../../../store/workspace-credentials";
import { getAggregateCloudBilling } from "../../../services/cloud/aggregate-data.service";
import { getInsights as getAzureInsights } from "../../../services/azure/insights.service";
import { getInsights as getGcpInsights } from "../../../services/gcp/insights.service";
import { analyzeInfrastructure } from "../../../services/ai.service";

export interface BillingStats {
    totalCurrentSpend: number;
    totalProjectedSpend: number;
    primaryUnit: string;
    topServices: any[];
    providersData: any[];
}

export interface InsightStats {
    recommendations: any[];
    diagnosis: any[];
    optimizations: any[];
}

export async function collectBillingStats(userId: string, range: string): Promise<BillingStats | null> {
    const billingResult = await getAggregateCloudBilling(userId, "all", range);
    if (!billingResult.success || !billingResult.data || billingResult.data.length === 0) {
        return null;
    }

    let totalCurrentSpend = 0;
    let totalProjectedSpend = 0;
    let primaryUnit = "USD";
    const topServicesList: any[] = [];

    for (const provSummary of billingResult.data) {
        totalCurrentSpend += provSummary.currentSpend || 0;
        totalProjectedSpend += provSummary.projectedTotal || 0;
        primaryUnit = provSummary.unit || primaryUnit;

        if (provSummary.breakdown) {
            for (const item of provSummary.breakdown) {
                topServicesList.push({
                    ...(item as any),
                    provider: provSummary.provider,
                });
            }
        }
    }

    const topServices = topServicesList
        .sort((a: any, b: any) => Number(b.amount || b.cost || 0) - Number(a.amount || a.cost || 0))
        .slice(0, 10);

    return {
        totalCurrentSpend,
        totalProjectedSpend,
        primaryUnit,
        topServices,
        providersData: billingResult.data,
    };
}

export async function collectInsightStats(userId: string): Promise<InsightStats> {
    const recommendations: any[] = [];
    const diagnosis: any[] = [];
    const optimizations: any[] = [];

    // 1. AWS Insights
    const awsCreds = await getCredentials(userId, "aws");
    if (awsCreds?.roleArn) {
        try {
            const aiResult = await analyzeInfrastructure(userId, awsCreds.roleArn, awsCreds.externalId);
            const insights = aiResult.insights || {};
            recommendations.push(...(insights.recommendations || []).map((r: any) => ({ ...r, provider: "aws" })));
            diagnosis.push(...(insights.diagnosis || []).map((d: any) => ({ ...d, provider: "aws" })));
            optimizations.push(...(insights.optimizations || []).map((o: any) => ({ ...o, provider: "aws" })));
        } catch (err) {
            console.error("[Usage-Report] AWS infrastructure analysis failed:", err);
        }
    }

    // 2. Azure Insights
    const azureCreds = await getCredentials(userId, "azure");
    if (azureCreds && azureCreds.tenantId && azureCreds.subscriptionId) {
        try {
            const azureResult = await getAzureInsights(
                azureCreds.tenantId,
                azureCreds.subscriptionId,
                azureCreds.clientId || "",
                azureCreds.clientSecret || ""
            );
            if (azureResult.recommendations) {
                recommendations.push(...azureResult.recommendations.map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description,
                    impact: r.impact,
                    category: r.category,
                    savings: r.savingsPercentage ? `${r.savingsPercentage}% savings` : "Optimize",
                    action: r.description,
                    provider: "azure"
                })));
            }
        } catch (err) {
            console.error("[Usage-Report] Azure Advisor query failed:", err);
        }
    }

    // 3. GCP Insights
    const gcpCreds = await getCredentials(userId, "gcp");
    if (gcpCreds && gcpCreds.projectId && gcpCreds.clientEmail) {
        try {
            const gcpResult = await getGcpInsights(
                gcpCreds.projectId,
                gcpCreds.clientEmail,
                gcpCreds.privateKey || ""
            );
            if (gcpResult.recommendations) {
                recommendations.push(...gcpResult.recommendations.map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description,
                    impact: r.impact,
                    category: r.category,
                    savings: r.savingsPercentage ? `${r.savingsPercentage}% savings` : "Optimize",
                    action: r.description,
                    provider: "gcp"
                })));
            }
        } catch (err) {
            console.error("[Usage-Report] GCP Recommender query failed:", err);
        }
    }

    return {
        recommendations,
        diagnosis,
        optimizations,
    };
}
