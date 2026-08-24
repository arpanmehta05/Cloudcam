import { createHash } from "node:crypto";
import { CostEstimationRequest, CostEstimationResult } from "./types";

interface CacheEntry {
  result: CostEstimationResult;
  expiresAt: number;
}

const sessionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export function cacheKeyFor(request: CostEstimationRequest): string {
  const fp = createHash("sha256")
    .update(
      JSON.stringify({
        nodes: request.nodes.map((n) => ({ id: n.id, serviceId: n.serviceId, config: n.config })),
        edges: request.edges,
        region: request.region,
      }),
    )
    .digest("hex")
    .slice(0, 32);
  return `${request.sessionId}:${fp}`;
}

export function getCached(key: string): CostEstimationResult | undefined {
  const entry = sessionCache.get(key);
  if (!entry) return;
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(key);
    return;
  }
  return entry.result;
}

export function setCached(key: string, result: CostEstimationResult): void {
  sessionCache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
