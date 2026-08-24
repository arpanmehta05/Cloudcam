// AWS Security Service
import { getSecuritySummary as getSecurity } from "../providers/security.provider";

export async function getSecurityData(workspaceId: string, region?: string, roleArn?: string, externalId?: string) {
    return getSecurity(workspaceId, region, roleArn, externalId);
}
