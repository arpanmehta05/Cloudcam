import type { CloudProvider } from "@/lib/regions";
import type { CloudProviderConnectionSummary } from "./provider-status";

const capabilities = {
    ready: {
        inventory: "ready",
        metrics: "ready",
        logs: "ready",
        billing: "ready",
        security: "ready",
        insights: "ready",
    },
    limited: {
        inventory: "limited",
        metrics: "limited",
        logs: "limited",
        billing: "setup_required",
        security: "limited",
        insights: "limited",
    },
    unavailable: {
        inventory: "unavailable",
        metrics: "unavailable",
        logs: "unavailable",
        billing: "unavailable",
        security: "unavailable",
        insights: "unavailable",
    },
} as const;

function summary(provider: CloudProvider, connected: boolean, status: CloudProviderConnectionSummary["status"]): CloudProviderConnectionSummary {
    return {
        provider,
        connected,
        status,
        connectedAt: connected ? new Date("2026-05-22T00:00:00.000Z").toISOString() : null,
        capabilities: connected ? (status === "ok" ? capabilities.ready : capabilities.limited) : capabilities.unavailable,
        metadata: {},
        warnings: status === "partial" ? [`${provider} is connected with partial capabilities.`] : [],
    };
}

export const CLOUD_CONNECTION_FIXTURES: Record<string, Record<CloudProvider, CloudProviderConnectionSummary>> = {
    none: {
        aws: summary("aws", false, "not_connected"),
        azure: summary("azure", false, "not_connected"),
        gcp: summary("gcp", false, "not_connected"),
    },
    awsOnly: {
        aws: summary("aws", true, "ok"),
        azure: summary("azure", false, "not_connected"),
        gcp: summary("gcp", false, "not_connected"),
    },
    allPartial: {
        aws: summary("aws", true, "ok"),
        azure: summary("azure", true, "partial"),
        gcp: summary("gcp", true, "partial"),
    },
};
