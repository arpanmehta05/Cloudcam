import { authFetchJson } from "@/lib/auth-fetch";
import type { CloudProvider } from "@/lib/regions";
import type {
    CloudAggregateResponse,
    CloudConnectionsResponse,
    NormalizedCloudResource,
} from "./provider-status";

export type CloudProviderFilter = CloudProvider | "all";

function cloudSearch(params: Record<string, string | number | undefined>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `?${query}` : "";
}

export function getCloudProviders() {
    return authFetchJson("/api/cloud/providers");
}

export function getCloudConnections(): Promise<CloudConnectionsResponse> {
    return authFetchJson<CloudConnectionsResponse>("/api/cloud/connections");
}

export function getCloudResources(params: { provider?: CloudProviderFilter; region?: string } = {}) {
    return authFetchJson<CloudAggregateResponse<NormalizedCloudResource>>(
        `/api/cloud/resources${cloudSearch({
            provider: params.provider || "all",
            region: params.region || "all",
        })}`
    );
}

export function getCloudMetrics(params: { provider?: CloudProviderFilter; service?: string; range?: string; region?: string } = {}) {
    return authFetchJson<CloudAggregateResponse<Record<string, unknown>>>(
        `/api/cloud/metrics${cloudSearch({
            provider: params.provider || "all",
            service: params.service || "compute",
            range: params.range || "24h",
            region: params.region || "all",
        })}`
    );
}

export function getCloudBilling(params: { provider?: CloudProviderFilter; range?: string } = {}) {
    return authFetchJson<CloudAggregateResponse<Record<string, unknown>>>(
        `/api/cloud/billing${cloudSearch({
            provider: params.provider || "all",
            range: params.range || "24h",
        })}`
    );
}

export function getCloudSecurity(params: { provider?: CloudProviderFilter; region?: string } = {}) {
    return authFetchJson<CloudAggregateResponse<Record<string, unknown>>>(
        `/api/cloud/security${cloudSearch({
            provider: params.provider || "all",
            region: params.region || "all",
        })}`
    );
}

export function getCloudInsights(params: { provider?: CloudProviderFilter; region?: string } = {}) {
    return authFetchJson<CloudAggregateResponse<Record<string, unknown>>>(
        `/api/cloud/insights${cloudSearch({
            provider: params.provider || "all",
            region: params.region || "all",
        })}`
    );
}

export function getCloudRecommendations(params: { provider?: CloudProviderFilter; region?: string; forceRefresh?: boolean } = {}) {
    return authFetchJson<Record<string, any>>(
        `/api/cloud/recommendations${cloudSearch({
            provider: params.provider || "all",
            region: params.region || "all",
            forceRefresh: params.forceRefresh ? "true" : undefined,
        })}`
    );
}

export function getCloudLogs(params: { provider?: CloudProviderFilter; service?: string; range?: number; region?: string } = {}) {
    return authFetchJson<CloudAggregateResponse<Record<string, unknown>>>(
        `/api/cloud/logs${cloudSearch({
            provider: params.provider || "all",
            service: params.service || "compute",
            range: params.range || 3600,
            region: params.region || "all",
        })}`
    );
}
