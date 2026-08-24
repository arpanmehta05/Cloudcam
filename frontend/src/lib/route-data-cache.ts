const API_CACHE_PREFIX = "rabbittwatch_route_data_cache:";
const DEFAULT_CACHE_TTL_MS = 60_000;
const SHORT_CACHE_TTL_MS = 10_000;
const LONG_CACHE_TTL_MS = 5 * 60_000;
const MAX_SESSION_CACHE_ENTRIES = 80;

const CACHEABLE_ROUTE_DATA_ENDPOINTS = [
    // Main, Compute, Data, Infrastructure, Compliance, and Operations routes.
    "/api/aws/credentials",
    "/api/aws/metrics",
    "/api/aws/billing",
    "/api/aws/resources",
    "/api/aws/security",
    "/api/aws/insights",
    "/api/aws/logs",
    "/api/aws/alarms",
    "/api/aws/alarm-metadata",
    "/api/aws/optimization",
    "/api/aws/actions/history",
    "/api/aws/actions/savings",
    "/api/vps-logs",
    "/api/usage-reports/preferences",
    "/api/ai-keys/status",
    "/api/ai-keys/usage",
    "/api/ai-keys/logs",
    "/api/ai-keys/per-key",

    // Azure routes
    "/api/azure/credentials",
    "/api/azure/metrics",
    "/api/azure/billing",
    "/api/azure/resources",
    "/api/azure/security",
    "/api/azure/insights",
    "/api/azure/logs",
    "/api/azure/alarms",
    "/api/azure/alarm-metadata",

    // GCP routes
    "/api/gcp/credentials",
    "/api/gcp/metrics",
    "/api/gcp/billing",
    "/api/gcp/resources",
    "/api/gcp/security",
    "/api/gcp/insights",
    "/api/gcp/logs",
    "/api/gcp/alarms",
    "/api/gcp/alarm-metadata",

    // Cloud aggregate routes
    "/api/cloud/providers",
    "/api/cloud/connections",
    "/api/cloud/resources",
    "/api/cloud/metrics",
    "/api/cloud/billing",
    "/api/cloud/security",
    "/api/cloud/insights",
    "/api/cloud/recommendations",
    "/api/cloud/logs",

    // AI Observability child routes.
    "/api/ai-observability",

    // Simulation category routes.
    "/api/simulations",
    "/api/simulation/session",
    "/api/deployment",
] as const;

type CachedResponseRecord = {
    body: string;
    headers: [string, string][];
    status: number;
    statusText: string;
    expiresAt: number;
};

const memoryCache = new Map<string, CachedResponseRecord>();
const inFlightCache = new Map<string, Promise<CachedResponseRecord>>();

function getRequestMethod(options?: RequestInit): string {
    return (options?.method || "GET").toUpperCase();
}

function getApiPath(url: string): string {
    try {
        return new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.origin).pathname;
    } catch {
        return url.split("?")[0];
    }
}

function isRouteDataEndpoint(url: string): boolean {
    const path = getApiPath(url);
    return CACHEABLE_ROUTE_DATA_ENDPOINTS.some((endpoint) => path === endpoint || path.startsWith(`${endpoint}/`));
}

function hasHeader(headers: HeadersInit, name: string): boolean {
    const target = name.toLowerCase();
    if (headers instanceof Headers) return headers.has(name);
    if (Array.isArray(headers)) return headers.some(([key]) => key.toLowerCase() === target);
    return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

function getCacheTtl(url: string): number {
    if (!isRouteDataEndpoint(url)) return 0;
    if (
        url.includes("/status") ||
        url.includes("/recent") ||
        url.includes("/logs") ||
        url.includes("/traces") ||
        url.includes("/deployment/") ||
        url.includes("/simulation/session")
    ) {
        return SHORT_CACHE_TTL_MS;
    }
    if (
        url.includes("/billing") ||
        url.includes("/cost") ||
        url.includes("/resources") ||
        url.includes("/security") ||
        url.includes("/insights") ||
        url.includes("/recommendations")
    ) {
        return LONG_CACHE_TTL_MS;
    }
    return DEFAULT_CACHE_TTL_MS;
}

function isCacheableRouteDataRequest(url: string, options?: RequestInit): boolean {
    if (typeof window === "undefined") return false;
    if (getRequestMethod(options) !== "GET") return false;
    if (options?.cache === "no-store" || options?.cache === "reload") return false;
    return getCacheTtl(url) > 0;
}

function getUserCacheScope(): string {
    const token = localStorage.getItem("rabbittize_token")?.trim();
    return token ? token.slice(-16) : "anonymous";
}

function getCleanUrlForCache(url: string): string {
    try {
        const parsed = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.origin);
        parsed.searchParams.delete("forceRefresh");
        return parsed.pathname + parsed.search;
    } catch {
        return url.replace(/[&?]forceRefresh=[^&]*/g, "").replace(/\?$/, "");
    }
}

function buildCacheKey(url: string): string {
    return `${API_CACHE_PREFIX}${getUserCacheScope()}:${url}`;
}

function readSessionCache(key: string): CachedResponseRecord | null {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const cached = JSON.parse(raw) as CachedResponseRecord;
        if (!cached?.expiresAt || cached.expiresAt <= Date.now()) {
            sessionStorage.removeItem(key);
            return null;
        }
        memoryCache.set(key, cached);
        return cached;
    } catch {
        sessionStorage.removeItem(key);
        return null;
    }
}

function getCachedRecord(key: string): CachedResponseRecord | null {
    const memoryCached = memoryCache.get(key);
    if (memoryCached) {
        if (memoryCached.expiresAt > Date.now()) return memoryCached;
        memoryCache.delete(key);
    }
    return readSessionCache(key);
}

function trimSessionCache(): void {
    const entries: Array<{ key: string; expiresAt: number }> = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (!key?.startsWith(API_CACHE_PREFIX)) continue;
        try {
            const value = JSON.parse(sessionStorage.getItem(key) || "{}") as CachedResponseRecord;
            entries.push({ key, expiresAt: value.expiresAt || 0 });
        } catch {
            entries.push({ key, expiresAt: 0 });
        }
    }

    entries
        .sort((a, b) => a.expiresAt - b.expiresAt)
        .slice(0, Math.max(0, entries.length - MAX_SESSION_CACHE_ENTRIES))
        .forEach(({ key }) => sessionStorage.removeItem(key));
}

function writeCacheRecord(key: string, record: CachedResponseRecord): void {
    memoryCache.set(key, record);
    try {
        sessionStorage.setItem(key, JSON.stringify(record));
        trimSessionCache();
    } catch {
        sessionStorage.removeItem(key);
    }
}

function responseFromRecord(record: CachedResponseRecord, cacheState: "HIT" | "MISS"): Response {
    const headers = new Headers(record.headers);
    headers.set("x-rabbittwatch-route-data-cache", cacheState);
    return new Response(record.body, {
        headers,
        status: record.status,
        statusText: record.statusText,
    });
}

async function fetchCacheRecord(
    resolvedUrl: string,
    options: RequestInit | undefined,
    headers: Record<string, string>,
    ttl: number,
    cleanUrl: string
): Promise<CachedResponseRecord> {
    const response = await fetch(resolvedUrl, { ...options, headers, cache: "no-store" });
    const body = await response.clone().text();
    const record: CachedResponseRecord = {
        body,
        headers: Array.from(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
        expiresAt: Date.now() + ttl,
    };

    if (response.ok) {
        writeCacheRecord(buildCacheKey(cleanUrl), record);
    }

    return record;
}

export function clearRouteDataCache(): void {
    memoryCache.clear();
    inFlightCache.clear();
    if (typeof window === "undefined") return;
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(API_CACHE_PREFIX)) sessionStorage.removeItem(key);
    }
}

export function clearRouteDataCacheAfterMutation(method: string): void {
    if (method !== "GET") clearRouteDataCache();
}

export function routeDataCachedFetch(
    resolvedUrl: string,
    options: RequestInit | undefined,
    headers: Record<string, string>
): Promise<Response> | null {
    if (!isCacheableRouteDataRequest(resolvedUrl, options)) return null;

    const cleanUrl = getCleanUrlForCache(resolvedUrl);
    const cacheKey = buildCacheKey(cleanUrl);

    // Bypass cache read if force-refresh is requested or explicit bypass header is set
    const isBypass = (options?.headers && hasHeader(options.headers, "x-rabbittwatch-cache-bypass")) ||
                     resolvedUrl.includes("forceRefresh=true");

    const cached = isBypass ? null : getCachedRecord(cacheKey);
    if (cached) return Promise.resolve(responseFromRecord(cached, "HIT"));

    const ttl = getCacheTtl(cleanUrl);

    // If options has an abort signal, listen to the abort event to immediately
    // delete the in-flight cache entry. This prevents subsequent renders (e.g. React Strict Mode)
    // from reusing a promise that is being aborted.
    if (options?.signal) {
        options.signal.addEventListener("abort", () => {
            inFlightCache.delete(cacheKey);
        });
    }

    const pending = inFlightCache.get(cacheKey) || fetchCacheRecord(resolvedUrl, options, headers, ttl, cleanUrl).finally(() => {
        inFlightCache.delete(cacheKey);
    });
    inFlightCache.set(cacheKey, pending);
    return pending.then((record) => responseFromRecord(record, "MISS"));
}
