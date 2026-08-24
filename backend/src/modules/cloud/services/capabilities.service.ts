import { CloudProvider, WorkspaceCredentials } from "../../../models/aws.model";
import {
    CloudProviderCapabilities,
    CloudProviderConnectionSummary,
} from "../../../providers/cloud/types";
import { getCloudProvider, getCloudProviderIds } from "../../../providers/cloud/registry";
import { getCredentials, isConnected } from "../../../store/workspace-credentials";

const unavailableCapabilities: CloudProviderCapabilities = {
    inventory: "unavailable",
    metrics: "unavailable",
    logs: "unavailable",
    billing: "unavailable",
    security: "unavailable",
    insights: "unavailable",
};

function deriveCapabilities(provider: CloudProvider, creds: WorkspaceCredentials | null): CloudProviderCapabilities {
    if (!creds) return getCloudProvider(provider).definition.defaultCapabilities || unavailableCapabilities;

    if (provider === "aws") {
        const ready = !!creds.roleArn;
        return {
            inventory: ready ? "ready" : "unavailable",
            metrics: ready ? "ready" : "unavailable",
            logs: ready ? "ready" : "setup_required",
            billing: ready ? "ready" : "unavailable",
            security: ready ? "ready" : "unavailable",
            insights: ready ? "ready" : "unavailable",
        };
    }

    if (provider === "azure") {
        const hasSecretAuth = !!(creds.tenantId && creds.subscriptionId && creds.clientId && creds.clientSecret);
        const hasPrincipalAssignment = !!(creds.tenantId && creds.subscriptionId && creds.principalId);
        
        if (hasSecretAuth) {
            return {
                inventory: "ready",
                metrics: "ready",
                logs: "ready",
                billing: "ready",
                security: "ready",
                insights: "ready",
            };
        } else if (hasPrincipalAssignment) {
            return {
                inventory: "limited",
                metrics: "setup_required",
                logs: "setup_required",
                billing: "setup_required",
                security: "setup_required",
                insights: "setup_required",
            };
        } else {
            return unavailableCapabilities;
        }
    }

    const hasGcpCredentials = !!(creds.projectId && creds.clientEmail && creds.privateKey);
    const hasGcpBillingExport = !!(creds.billingDatasetId && creds.billingTableId);
    return {
        inventory: hasGcpCredentials ? "ready" : "unavailable",
        metrics: hasGcpCredentials ? "ready" : "unavailable",
        logs: hasGcpCredentials ? "ready" : "unavailable",
        billing: hasGcpCredentials ? (hasGcpBillingExport ? "ready" : "setup_required") : "unavailable",
        security: hasGcpCredentials ? "ready" : "unavailable",
        insights: hasGcpCredentials ? "ready" : "unavailable",
    };
}

function metadataFor(provider: CloudProvider, creds: WorkspaceCredentials | null): Record<string, unknown> {
    if (!creds) return {};
    if (provider === "aws") {
        return {
            roleArn: creds.roleArn || null,
        };
    }
    if (provider === "azure") {
        return {
            tenantId: creds.tenantId || null,
            subscriptionId: creds.subscriptionId || null,
            billingAccountId: creds.billingAccountId || null,
            clientId: creds.clientId || null,
            principalId: creds.principalId || null,
            authMode: creds.clientId && creds.clientSecret ? "service_principal_secret" : "principal_assignment",
        };
    }
    return {
        projectId: creds.projectId || null,
        clientEmail: creds.clientEmail || null,
        billingDatasetId: creds.billingDatasetId || null,
        billingTableId: creds.billingTableId || null,
    };
}

function warningsFor(provider: CloudProvider, capabilities: CloudProviderCapabilities): string[] {
    const warnings: string[] = [];
    if (provider === "azure" && capabilities.inventory === "limited") {
        warnings.push("Azure is connected through principal assignment only. Full data collection needs service principal client credentials or central app auth.");
    }
    if (provider === "azure" && capabilities.billing === "ready") {
        warnings.push("Azure Cost Management availability depends on subscription type and billing permissions.");
    }
    if (provider === "gcp") {
        if (capabilities.billing === "setup_required") warnings.push("GCP billing requires Cloud Billing export to BigQuery before real cost data can be shown.");
    }
    return warnings;
}

export async function getProviderConnectionSummary(
    userId: string,
    provider: CloudProvider
): Promise<CloudProviderConnectionSummary> {
    const creds = await getCredentials(userId, provider);
    const connected = await isConnected(userId, provider);
    const capabilities = deriveCapabilities(provider, creds);
    const warnings = connected ? warningsFor(provider, capabilities) : [];
    const partial = Object.values(capabilities).some(status => status === "limited" || status === "setup_required");

    return {
        provider,
        connected,
        connectionId: creds?.connectionId,
        connectedAt: creds?.connectedAt || null,
        lastSyncAt: creds?.lastSyncAt || null,
        lastSuccessfulSyncAt: creds?.lastSuccessfulSyncAt || null,
        lastSyncStatus: creds?.lastSyncStatus || "never",
        lastError: creds?.lastError || null,
        source: creds?.source || null,
        status: connected ? (partial ? "partial" : "ok") : "not_connected",
        capabilities,
        metadata: metadataFor(provider, creds),
        warnings,
    };
}

export async function getAllProviderConnectionSummaries(userId: string) {
    const entries = await Promise.all(
        getCloudProviderIds().map(async provider => [
            provider,
            await getProviderConnectionSummary(userId, provider),
        ] as const)
    );
    return Object.fromEntries(entries) as Record<CloudProvider, CloudProviderConnectionSummary>;
}
