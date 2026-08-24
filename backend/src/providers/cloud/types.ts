import { Request } from "express";
import { CloudProvider, WorkspaceCredentials } from "../../models/aws.model";

export { CloudProvider, WorkspaceCredentials };

export interface CloudRequestContext {
    userId: string;
    provider: CloudProvider;
    connectionId?: string;
}

export interface CloudProviderDefinition {
    id: CloudProvider;
    label: string;
    shortLabel: string;
    status: "available" | "partial" | "planned";
    defaultRegion: string;
    globalRegion: string;
    setupHref: string;
    setupObject: string;
    accountName: string;
    connectTitle: string;
    metricsSource: string;
    defaultCapabilities: CloudProviderCapabilities;
}

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

export interface CloudAggregateMetric {
    provider: CloudProvider;
    service: string;
    metric: string;
    displayName: string;
    unit?: string;
    data: Array<{ timestamp: string; value: number }>;
    raw?: unknown;
}

export interface CloudAggregateBillingSummary {
    provider: CloudProvider;
    currentSpend: number;
    mtdSpend?: number;
    unit: string;
    projectedTotal?: number | null;
    breakdown?: unknown[];
    history?: Array<{ date: string; amount: number }>;
    raw?: unknown;
}

export interface CloudAggregateSecuritySummary {
    provider: CloudProvider;
    severity?: number;
    status: string;
    findingsCount?: number;
    raw?: unknown;
}

export interface CloudAggregateInsight {
    provider: CloudProvider;
    id: string;
    title: string;
    category?: string;
    impact?: string;
    resourceId?: string;
    raw?: unknown;
}

export interface CloudRecommendationHubItem {
    id: string;
    provider: CloudProvider;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    category: string;
    savings?: string;
    action: string;
    resourceId?: string;
    source?: string;
    actionPlan?: {
        actionId: string;
        targets: { resourceId: string; resourceName: string; region: string }[];
        estimatedSavings: number;
        reasoning: string;
    };
    raw?: unknown;
}

export interface CloudRecommendationHubDiagnosis {
    provider: CloudProvider;
    title: string;
    status: "healthy" | "warning" | "critical";
    details: string;
}

export interface CloudRecommendationHubOptimization {
    id: string;
    provider: CloudProvider;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
    savings?: string;
    action: string;
}

export interface CloudRecommendationHubResponse {
    success: true;
    providers: Record<CloudProvider, CloudProviderConnectionSummary>;
    insights: {
        recommendations: CloudRecommendationHubItem[];
        diagnosis: CloudRecommendationHubDiagnosis[];
        optimizations: CloudRecommendationHubOptimization[];
        warnings: string[];
    };
    metrics: {
        resources: NormalizedCloudResource[];
        billing: CloudAggregateBillingSummary[];
        security: CloudAggregateSecuritySummary[];
    };
    generatedAt: string;
    warnings: string[];
    syncInProgress?: boolean;
}

export interface CloudAggregateLogEntry {
    provider: CloudProvider;
    timestamp: string;
    severity?: string;
    message: string;
    resource?: string;
    raw?: unknown;
}

export interface CloudAggregateResponse<T> {
    success: true;
    providers: Record<CloudProvider, CloudProviderConnectionSummary>;
    data: T[];
    warnings: string[];
}

export interface CloudProviderAdapter {
    definition: CloudProviderDefinition;
    connect?(context: CloudRequestContext): Promise<unknown>;
    listResources?(context: CloudRequestContext, region?: string): Promise<unknown>;
    getMetrics?(context: CloudRequestContext, service: string, range: string, region?: string): Promise<unknown>;
    getLogs?(context: CloudRequestContext, query: string, logGroups: string[], range: number, region?: string): Promise<unknown>;
    getAlerts?(context: CloudRequestContext, region?: string): Promise<unknown>;
    createAlert?(context: CloudRequestContext, payload: unknown): Promise<unknown>;
    getCost?(context: CloudRequestContext, range?: string): Promise<unknown>;
    getSecurity?(context: CloudRequestContext, region?: string): Promise<unknown>;
    getInsights?(context: CloudRequestContext, region?: string): Promise<unknown>;
    deployBlueprint?(context: CloudRequestContext, payload: unknown): Promise<unknown>;
}

export interface CloudAwareRequest extends Request {
    cloudContext?: CloudRequestContext;
}
