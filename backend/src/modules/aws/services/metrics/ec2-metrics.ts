import { getInventoryBasedMetrics } from "./inventory-based";

export async function getEc2Metrics(
  workspaceId: string,
  range: string,
  region?: string,
  roleArn?: string,
  externalId?: string,
  forceRefresh: boolean = false
) {
  return getInventoryBasedMetrics(workspaceId, "ec2", range, region, roleArn, externalId, forceRefresh);
}
