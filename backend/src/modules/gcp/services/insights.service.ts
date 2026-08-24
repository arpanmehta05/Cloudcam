// GCP Insights Service — canonical location: modules/gcp/services/insights.service.ts
import { getGcpInsights } from "../providers/insights.provider";

export async function getInsights(
    projectId: string,
    clientEmail: string,
    privateKey: string
) {
    return getGcpInsights(projectId, clientEmail, privateKey);
}
