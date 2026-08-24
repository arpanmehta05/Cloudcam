import type { CloudProvider } from "@/lib/regions";
import { authFetchJson } from "@/lib/auth-fetch";
import { CLOUD_PROVIDER_REGISTRY, getCloudProviderDefinition } from "./provider-registry";

export type CloudDataCapabilityStatus = "ready" | "limited" | "setup_required" | "unavailable";

export interface CloudProviderCapabilities {
    inventory: CloudDataCapabilityStatus;
    metrics: CloudDataCapabilityStatus;
    logs: CloudDataCapabilityStatus;
    billing: CloudDataCapabilityStatus;
    security: CloudDataCapabilityStatus;
    insights: CloudDataCapabilityStatus;
}

export interface CloudProviderConnectionSummary {
    provider: CloudProvider;
    connected: boolean;
    connectionId?: string;
    connectedAt?: string | null;
    lastSyncAt?: string | null;
    lastSuccessfulSyncAt?: string | null;
    lastSyncStatus?: "never" | "syncing" | "ok" | "partial" | "error";
    lastError?: string | null;
    source?: string | null;
    status: "not_connected" | "ok" | "partial" | "error";
    capabilities: CloudProviderCapabilities;
    metadata: Record<string, unknown>;
    warnings: string[];
}

export interface CloudConnectionsResponse {
    success: true;
    providers: Record<CloudProvider, CloudProviderConnectionSummary>;
}

export interface NormalizedCloudResource {
    provider: CloudProvider;
    service: string;
    nativeType: string;
    id: string;
    name: string;
    region: string;
    zone?: string;
    status?: string;
    accountOrProjectId: string;
    tags?: Record<string, string>;
    raw?: unknown;
}

export interface CloudAggregateResponse<T> {
    success: true;
    providers: Record<CloudProvider, CloudProviderConnectionSummary>;
    data: T[];
    warnings: string[];
}

export const PROVIDER_COPY: Record<CloudProvider, {
    shortLabel: string;
    accountName: string;
    connectTitle: string;
    setupHref: string;
    setupObject: string;
    metricsSource: string;
}> = Object.fromEntries(
    Object.values(CLOUD_PROVIDER_REGISTRY).map((provider) => [
        provider.id,
        {
            shortLabel: provider.shortLabel,
            accountName: provider.accountName,
            connectTitle: provider.connectTitle,
            setupHref: provider.setupHref,
            setupObject: provider.setupObject,
            metricsSource: provider.metricsSource,
        },
    ])
) as Record<CloudProvider, {
    shortLabel: string;
    accountName: string;
    connectTitle: string;
    setupHref: string;
    setupObject: string;
    metricsSource: string;
}>;

export function getProviderCopy(provider: CloudProvider) {
    const definition = getCloudProviderDefinition(provider);
    return PROVIDER_COPY[definition.id] || PROVIDER_COPY.aws;
}

export function getCapabilityLabel(status: CloudDataCapabilityStatus): string {
    if (status === "ready") return "Ready";
    if (status === "limited") return "Limited";
    if (status === "setup_required") return "Setup required";
    return "Unavailable";
}

export function getCapabilityDescription(capability: keyof CloudProviderCapabilities, status: CloudDataCapabilityStatus): string {
    if (status === "ready") return `${capability} data is available.`;
    if (status === "limited") return `${capability} data is partially available while provider parity is being completed.`;
    if (status === "setup_required") return `${capability} needs additional provider setup.`;
    return `${capability} is not available for this connection.`;
}

export function getProviderConnectionGate(provider: CloudProvider, summary?: CloudProviderConnectionSummary) {
    const copy = getProviderCopy(provider);
    return {
        provider,
        connected: !!summary?.connected,
        title: summary?.connected ? `${copy.shortLabel} Connected` : copy.connectTitle,
        description: summary?.connected
            ? `Your ${copy.accountName} is connected.`
            : `Connect your ${copy.accountName} to start monitoring this provider.`,
        setupHref: copy.setupHref,
        status: summary?.status || "not_connected",
        warnings: summary?.warnings || [],
        capabilities: summary?.capabilities,
    };
}

export async function getCloudConnections(): Promise<CloudConnectionsResponse> {
    return authFetchJson<CloudConnectionsResponse>("/api/cloud/connections");
}
