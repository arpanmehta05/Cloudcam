// Azure Insights Service — canonical location: modules/azure/services/insights.service.ts
import { getAzureInsights } from "../providers/insights.provider";

export async function getInsights(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string
) {
    return getAzureInsights(tenantId, subscriptionId, clientId, clientSecret);
}
