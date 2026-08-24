// Azure Security Service — canonical location: modules/azure/services/security.service.ts
import { getAzureSecuritySummary as getSecurity } from "../providers/security.provider";

export async function getSecurityData(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string
) {
    return getSecurity(tenantId, subscriptionId, clientId, clientSecret);
}
