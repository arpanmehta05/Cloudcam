import axios from "axios";
import { getAzureAccessToken } from "./client-factory";

export interface AzureInsight {
    id: string;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    category: "cost" | "security" | "performance" | "faultTolerance";
    savingsPercentage: number;
    type: string; // ec2, rds, s3, etc.
    resourceId?: string;
    source: string;
}

export interface AdvisorSummary {
    categories: {
        cost: number;
        security: number;
        performance: number;
        faultTolerance: number;
    };
}

/**
 * Maps Azure resource type to AWS-compatible service key for frontend filtering
 */
function mapAzureResourceTypeToAws(resourceId?: string): string {
    if (!resourceId) return "ec2";
    const low = resourceId.toLowerCase();
    if (low.includes("virtualmachines") || low.includes("compute")) return "ec2";
    if (low.includes("servers/databases") || low.includes("sql")) return "rds";
    if (low.includes("storageaccounts") || low.includes("storage")) return "s3";
    if (low.includes("sites") || low.includes("web") || low.includes("serverless")) return "lambda";
    if (low.includes("apimanagement") || low.includes("apigateway")) return "apigateway";
    if (low.includes("documentdb") || low.includes("cosmosdb")) return "dynamodb";
    if (low.includes("containerregistry") || low.includes("acr")) return "ecr";
    if (low.includes("containerservice") || low.includes("managedclusters")) return "eks";
    return "ec2";
}

/**
 * Normalizes Azure Advisor recommendation categories
 */
function normalizeCategory(cat: string): "cost" | "security" | "performance" | "faultTolerance" {
    const low = cat.toLowerCase();
    if (low === "cost") return "cost";
    if (low === "security") return "security";
    if (low === "performance") return "performance";
    return "faultTolerance"; // Maps HighAvailability/OperationalExcellence to faultTolerance
}

/**
 * Normalizes Advisor recommendation
 */
function normalizeRecommendation(rec: any): AzureInsight {
    const props = rec.properties || {};
    const category = normalizeCategory(props.category || "Cost");

    return {
        id: rec.id || `rec-${Math.random()}`,
        title: props.shortDescription?.problem || rec.name || "Advisor Recommendation",
        description: props.shortDescription?.solution || "Optimize Azure resources.",
        impact: (props.impact || "Medium").toLowerCase() as "high" | "medium" | "low",
        category,
        savingsPercentage: 0,
        type: mapAzureResourceTypeToAws(props.resourceMetadata?.resourceId),
        resourceId: props.resourceMetadata?.resourceId,
        source: "azure-advisor"
    };
}

/**
 * Queries Azure Advisor REST API
 */
export async function getAzureInsights(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string
): Promise<{
    recommendations: AzureInsight[];
    trustedAdvisor: AdvisorSummary;
    setupRequired?: boolean;
    warning?: string;
    error?: boolean;
}> {
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
        return {
            recommendations: [],
            trustedAdvisor: {
                categories: { cost: 0, security: 0, performance: 0, faultTolerance: 0 }
            },
            setupRequired: true,
            warning: "Azure Insights integration is not configured. Please configure service principal credentials in Settings."
        };
    }

    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Advisor/recommendations?api-version=2022-10-01`;

        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });

        const recs = res.data?.value || [];
        const normalized = recs.map(normalizeRecommendation);

        // Compute trusted advisor category summaries
        const categories = {
            cost: normalized.filter((r: AzureInsight) => r.category === "cost").length,
            security: normalized.filter((r: AzureInsight) => r.category === "security").length,
            performance: normalized.filter((r: AzureInsight) => r.category === "performance").length,
            faultTolerance: normalized.filter((r: AzureInsight) => r.category === "faultTolerance").length
        };

        return {
            recommendations: normalized,
            trustedAdvisor: { categories }
        };
    } catch (error: any) {
        console.error("[getAzureInsights] Advisor API query failed:", error.message);
        return {
            recommendations: [],
            trustedAdvisor: {
                categories: { cost: 0, security: 0, performance: 0, faultTolerance: 0 }
            },
            error: true,
            warning: `Azure Advisor query failed: ${error.message}. Please verify service principal permissions in Settings.`
        };
    }
}
