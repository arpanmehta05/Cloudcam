// ─── In-Memory Response Cache Middleware ───
// Caches successful API responses per-user to avoid redundant AWS calls.
// Each route can opt-in with a TTL. The cache key is: userId + request path + query string.

export interface CacheEntry {
  data: any;
  expiresAt: number;
  statusCode: number;
}

const cache = new Map<string, CacheEntry>();

// Periodic cleanup every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
  },
  5 * 60 * 1000,
);

/**
 * Build a cache key from the request.
 * Format: userId:method:path:sortedQueryString
 */
function buildKey(
  userId: string,
  req: { method: string; originalUrl: string },
): string {
  return `${userId}:${req.method}:${req.originalUrl}`;
}

/**
 * Get a cached response if available and not expired.
 */
export function getCached(
  userId: string,
  req: {
    method: string;
    originalUrl: string;
    headers?: Record<string, any>;
    query?: Record<string, any>;
  },
): CacheEntry | null {
  if (
    req.headers?.["x-rabbittwatch-cache-bypass"] === "true" ||
    req.query?.forceRefresh === "true"
  ) {
    return null;
  }

  const key = buildKey(userId, req);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry;
}

/**
 * Store a response in the cache.
 */
export function setCached(
  userId: string,
  req: { method: string; originalUrl: string },
  data: any,
  ttlMs: number,
  statusCode: number = 200,
): void {
  const key = buildKey(userId, req);
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    statusCode,
  });
}

/**
 * Invalidate all cache entries for a user (e.g., after a mutation).
 */
export function invalidateUser(userId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      cache.delete(key);
    }
  }
}

/**
 * Invalidate cache entries matching a pattern for a user.
 */
export function invalidatePattern(userId: string, pathPattern: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`) && key.includes(pathPattern)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache stats for monitoring.
 */
export function getCacheStats(): { entries: number; keys: string[] } {
  return {
    entries: cache.size,
    keys: Array.from(cache.keys()),
  };
}

// ─── TTL Presets (in milliseconds) ───
export const CacheTTL = {
  RESOURCES: 3 * 60 * 1000, // 3 minutes — resource inventory changes infrequently
  BILLING: 5 * 60 * 1000, // 5 minutes — billing data updates slowly
  METRICS: 2 * 60 * 1000, // 2 minutes — metrics should feel relatively fresh
  SECURITY: 3 * 60 * 1000, // 3 minutes — security findings don't change rapidly
  CREDENTIALS: 10 * 60 * 1000, // 10 minutes — credentials rarely change
  ALARMS: 2 * 60 * 1000, // 2 minutes
  INSIGHTS: 5 * 60 * 1000, // 5 minutes
} as const;
