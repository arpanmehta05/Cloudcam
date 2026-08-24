import { CloudProvider, ResourceInventory, WorkspaceCredentials } from "../../../models/aws.model";
import { CloudProviderConnectionSummary, NormalizedCloudResource } from "../../../providers/cloud/types";
import { getCredentials } from "../../../store/workspace-credentials";
import { getCloudProviderIds } from "../../../providers/cloud/registry";
import { sanitizeProviderError, withProviderSync } from "./sync-guard.service";
import { getAllProviderConnectionSummaries } from "./capabilities.service";
import { getResources as getAwsResources } from "../../../services/aws/resources.service";
import { getResources as getAzureResources } from "../../../services/azure/resources.service";
import { getResources as getGcpResources } from "../../../services/gcp/resources.service";

function getUserIdAccount(provider: CloudProvider, creds: WorkspaceCredentials | null): string {
    if (provider === "aws") return creds?.roleArn?.match(/arn:aws:iam::(\d+):/)?.[1] || "unknown";
    if (provider === "azure") return creds?.subscriptionId || "unknown";
    return creds?.projectId || "unknown";
}

function resourceName(resource: any): string {
    return resource?.name || resource?.id || resource?.arn || "unnamed";
}

function normalizeInventory(
    provider: CloudProvider,
    creds: WorkspaceCredentials | null,
    inventory: ResourceInventory
): NormalizedCloudResource[] {
    const accountOrProjectId = getUserIdAccount(provider, creds);
    const rows: NormalizedCloudResource[] = [];

    for (const [service, value] of Object.entries(inventory)) {
        if (!Array.isArray(value) || service === "alerts" || service.startsWith("__")) continue;
        for (const resource of value) {
            rows.push({
                provider,
                service,
                nativeType: resource?.type || resource?.engine || service,
                id: resource?.id || resource?.arn || resourceName(resource),
                name: resourceName(resource),
                region: resource?.region || resource?.availabilityZone || "global",
                zone: resource?.zone,
                status: resource?.state || resource?.status,
                accountOrProjectId,
                tags: resource?.tags,
                raw: resource,
            });
        }
    }

    return rows;
}

async function loadProviderInventory(
    userId: string,
    provider: CloudProvider,
    region: string,
    forceRefresh: boolean = false
): Promise<{ provider: CloudProvider; data: NormalizedCloudResource[]; warning?: string }> {
    const creds = await getCredentials(userId, provider);
    if (!creds) return { provider, data: [], warning: `${provider} is not connected.` };

    if (provider === "aws") {
        const inventory = await getAwsResources(userId, region, creds.roleArn, creds.externalId, forceRefresh);
        return { provider, data: normalizeInventory(provider, creds, inventory) };
    }

    if (provider === "azure") {
        if (!creds.tenantId || !creds.subscriptionId || !creds.clientId || !creds.clientSecret) {
            return {
                provider,
                data: [],
                warning: "Azure full inventory requires service principal client credentials. Principal-assignment onboarding is connected but limited.",
            };
        }
        const inventory = await getAzureResources(
            userId,
            region,
            creds.tenantId,
            creds.subscriptionId,
            creds.clientId,
            creds.clientSecret,
            forceRefresh
        );
        const azureWarnings = Array.isArray(inventory.__warnings)
            ? inventory.__warnings.map((item: any) => `Azure ${item.service}: ${item.message}`).join(" | ")
            : undefined;
        return { provider, data: normalizeInventory(provider, creds, inventory), warning: azureWarnings };
    }

    if (!creds.projectId || !creds.clientEmail || !creds.privateKey) {
        return { provider, data: [], warning: "GCP is not connected." };
    }
    const inventory = await getGcpResources(userId, region, creds.projectId, creds.clientEmail, creds.privateKey, forceRefresh);
    const warnings = Array.isArray(inventory.__warnings)
        ? inventory.__warnings.map((item: any) => `GCP ${item.service}: ${item.message}`).join(" | ")
        : undefined;
    return { provider, data: normalizeInventory(provider, creds, inventory), warning: warnings };
}

export async function getAggregateCloudResources(userId: string, provider: CloudProvider | "all", region = "all", forceRefresh = false) {
    const providerSummaries = await getAllProviderConnectionSummaries(userId);
    const targetProviders = (provider === "all" ? getCloudProviderIds() : [provider]).filter(
        p => providerSummaries[p]?.connected
    );
    const results = await Promise.allSettled(
        targetProviders.map(item => withProviderSync(userId, item, "inventory", () => loadProviderInventory(userId, item, region, forceRefresh)))
    );
    const data: NormalizedCloudResource[] = [];
    const warnings: string[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            data.push(...result.value.data);
            if (result.value.warning) warnings.push(result.value.warning);
        } else {
            warnings.push(sanitizeProviderError(result.reason) || "Failed to load provider inventory.");
        }
    }

    return {
        success: true as const,
        providers: providerSummaries as Record<CloudProvider, CloudProviderConnectionSummary>,
        data,
        warnings,
    };
}
