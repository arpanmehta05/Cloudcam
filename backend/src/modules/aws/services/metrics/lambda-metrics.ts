import { getInventoryBasedMetrics } from "./inventory-based";

export async function getLambdaMetrics(
  workspaceId: string,
  range: string,
  region?: string,
  roleArn?: string,
  externalId?: string,
  forceRefresh: boolean = false
) {
  return getInventoryBasedMetrics(workspaceId, "lambda", range, region, roleArn, externalId, forceRefresh);
}
