// GCP Security Service — canonical location: modules/gcp/services/security.service.ts
import { getGcpSecuritySummary as getSecurity } from "../providers/security.provider";

export async function getSecurityData(
    projectId: string,
    clientEmail: string,
    privateKey: string
) {
    return getSecurity(projectId, clientEmail, privateKey);
}
