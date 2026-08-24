import { MemoryCache } from "../../../../core/cache/memory-cache";

export const metricsCache = new MemoryCache();

export function makeCacheKey(workspaceId: string, serviceKey: string, range: string, region = "all") {
    return `${workspaceId}:${serviceKey}:${range}:${region}`;
}

export function cacheTtlMs(range: string): number {
    return (range === "7d" || range === "30d") ? 30 * 60 * 1000 : 5 * 60 * 1000;
}
