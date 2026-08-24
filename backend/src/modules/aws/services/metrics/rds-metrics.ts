import { getInventoryBasedMetrics } from "./inventory-based";

export async function getRdsMetrics(
  workspaceId: string,
  range: string,
  region?: string,
  roleArn?: string,
  externalId?: string,
  forceRefresh: boolean = false
) {
  return getInventoryBasedMetrics(workspaceId, "rds", range, region, roleArn, externalId, forceRefresh);
}
