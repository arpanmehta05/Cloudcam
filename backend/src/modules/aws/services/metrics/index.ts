import { SERVICE_REGISTRY } from "../../../../data/service-registry";
import { metricsCache, makeCacheKey, cacheTtlMs } from "./cache";
import { getS3Metrics } from "./s3-metrics";
import { getEcsMetrics } from "./ecs-metrics";
import { getNetworkingMetrics } from "./networking-metrics";
import { getInventoryBasedMetrics } from "./inventory-based";

export * from "./ec2-metrics";
export * from "./rds-metrics";
export * from "./lambda-metrics";
export * from "./ecs-metrics";
export * from "./s3-metrics";
export * from "./networking-metrics";
export * from "./inventory-based";

export async function getServiceMetrics(
    workspaceId: string,
    serviceKey: string,
    range: string,
    region?: string,
    roleArn?: string,
    externalId?: string,
    forceRefresh: boolean = false
) {
    const categoryMap: Record<string, string> = {
        gcp_compute: "ec2",
        gcp_storage: "s3",
        gcp_sql: "rds",
        gcp_function: "lambda",
        gcp_gke: "eks",
        azure_vm: "ec2",
        azure_storage: "s3",
        azure_sql: "rds",
        azure_function: "lambda",
        azure_vnet: "efs"
    };
    const resolvedKey = categoryMap[serviceKey] || serviceKey;
    const service = SERVICE_REGISTRY[resolvedKey];
    if (!service) throw new Error("Invalid or missing service key");

    // Check cache first
    const cacheKey = makeCacheKey(workspaceId, serviceKey, range, region);
    const cached = metricsCache.get(cacheKey);
    if (!forceRefresh && cached) {
        console.log(`[Metrics] Cache HIT for ${serviceKey} (${range}/${region ?? "all"})`);
        return cached;
    }

    let result: any;
    if (resolvedKey === "s3") result = await getS3Metrics(workspaceId, range, region, roleArn, externalId, forceRefresh);
    else if (resolvedKey === "ecs") result = await getEcsMetrics(workspaceId, range, region, roleArn, externalId, forceRefresh);
    else if (resolvedKey === "networking") result = await getNetworkingMetrics(workspaceId, range, region, roleArn, externalId, forceRefresh);
    else result = await getInventoryBasedMetrics(workspaceId, resolvedKey, range, region, roleArn, externalId, forceRefresh);

    metricsCache.set(cacheKey, result, cacheTtlMs(range));
    return result;
}
