import { CloudProvider, CloudAggregateSecuritySummary, CloudAggregateInsight, CloudAggregateResponse, CloudProviderConnectionSummary } from "../../../../providers/cloud/types";
import { getAllProviderConnectionSummaries } from "../capabilities.service";
import { selectedProviders } from "./helpers";
import { getCredentials } from "../../../../store/workspace-credentials";
import { sanitizeProviderError, withProviderSync } from "../sync-guard.service";
import { getSecurityData as getAwsSecurityData } from "../../../../services/aws/security.service";
import { getSecurityData as getAzureSecuritySummary } from "../../../../services/azure/security.service";
import { getSecurityData as getGcpSecuritySummary } from "../../../../services/gcp/security.service";
import { getInsights as getAwsInsights } from "../../../../services/aws/insights.service";
import { getInsights as getAzureInsights } from "../../../../services/azure/insights.service";
import { getInsights as getGcpInsights } from "../../../../services/gcp/insights.service";

export async function getAggregateCloudSecurity(
    userId: string,
    provider: CloudProvider | "all",
    region: string
): Promise<CloudAggregateResponse<CloudAggregateSecuritySummary>> {
    const providerSummaries = await getAllProviderConnectionSummaries(userId);
    const targetProviders = selectedProviders(provider, providerSummaries);

    const results = await Promise.allSettled(
        targetProviders.map((prov) => withProviderSync(userId, prov, "security", async () => {
            const creds = await getCredentials(userId, prov);
            if (!creds) {
                return { provider: prov, data: null, warnings: [`${prov} is not connected.`] };
            }

            if (prov === "aws") {
                try {
                    const result = await getAwsSecurityData(userId, region, creds.roleArn, creds.externalId);
                    const summary: CloudAggregateSecuritySummary = {
                        provider: prov,
                        severity: result.threats.maxSeverity,
                        status: result.compliance.status,
                        findingsCount: result.threats.count,
                        raw: result
                    };
                    return { provider: prov, data: summary, warnings: [] };
                } catch (err: any) {
                    return { provider: prov, data: null, warnings: [`AWS security failed: ${err.message || err}`] };
                }
            }

            if (prov === "azure") {
                try {
                    const result = await getAzureSecuritySummary(
                        creds.tenantId || "",
                        creds.subscriptionId || "",
                        creds.clientId || "",
                        creds.clientSecret || ""
                    );
                    const summary: CloudAggregateSecuritySummary = {
                        provider: prov,
                        severity: result.threats.maxSeverity,
                        status: result.compliance.status,
                        findingsCount: result.threats.count,
                        raw: result
                    };
                    return { provider: prov, data: summary, warnings: result.warning ? [result.warning] : [] };
                } catch (err: any) {
                    return { provider: prov, data: null, warnings: [`Azure security failed: ${err.message || err}`] };
                }
            }

            // GCP provider
            try {
                const result = await getGcpSecuritySummary(
                    creds.projectId || "",
                    creds.clientEmail || "",
                    creds.privateKey || ""
                );
                const summary: CloudAggregateSecuritySummary = {
                    provider: prov,
                    severity: result.threats.maxSeverity,
                    status: result.compliance.status,
                    findingsCount: result.threats.count,
                    raw: result
                };
                return { provider: prov, data: summary, warnings: result.warning ? [result.warning] : [] };
            } catch (err: any) {
                return { provider: prov, data: null, warnings: [`GCP security failed: ${err.message || err}`] };
            }
        }))
    );

    const data: CloudAggregateSecuritySummary[] = [];
    const warnings: string[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            if (result.value.data) {
                data.push(result.value.data);
            }
            if (result.value.warnings) {
                warnings.push(...result.value.warnings);
            }
        } else {
            warnings.push(sanitizeProviderError(result.reason) || "Failed to load provider security.");
        }
    }

    return {
        success: true,
        providers: providerSummaries as Record<CloudProvider, CloudProviderConnectionSummary>,
        data,
        warnings,
    };
}

export async function getAggregateCloudInsights(
    userId: string,
    provider: CloudProvider | "all",
    region: string
): Promise<CloudAggregateResponse<CloudAggregateInsight>> {
    const providerSummaries = await getAllProviderConnectionSummaries(userId);
    const targetProviders = selectedProviders(provider, providerSummaries);

    const results = await Promise.allSettled(
        targetProviders.map((prov) => withProviderSync(userId, prov, "insights", async () => {
            const creds = await getCredentials(userId, prov);
            if (!creds) {
                return { provider: prov, data: [], warnings: [`${prov} is not connected.`] };
            }

            if (prov === "aws") {
                try {
                    const result = await getAwsInsights(userId, region, creds.roleArn, creds.externalId);
                    const list: CloudAggregateInsight[] = (result.recommendations || []).map((r: any) => ({
                        provider: prov,
                        id: r.id,
                        title: r.title,
                        category: r.category,
                        impact: r.impact,
                        resourceId: r.resourceId,
                        raw: r
                    }));
                    return { provider: prov, data: list, warnings: [] };
                } catch (err: any) {
                    return { provider: prov, data: [], warnings: [`AWS insights failed: ${err.message || err}`] };
                }
            }

            if (prov === "azure") {
                try {
                    const result = await getAzureInsights(
                        creds.tenantId || "",
                        creds.subscriptionId || "",
                        creds.clientId || "",
                        creds.clientSecret || ""
                    );
                    const list: CloudAggregateInsight[] = (result.recommendations || []).map((r: any) => ({
                        provider: prov,
                        id: r.id,
                        title: r.title,
                        category: r.category,
                        impact: r.impact,
                        resourceId: r.resourceId,
                        raw: r
                    }));
                    return { provider: prov, data: list, warnings: result.warning ? [result.warning] : [] };
                } catch (err: any) {
                    return { provider: prov, data: [], warnings: [`Azure insights failed: ${err.message || err}`] };
                }
            }

            // GCP provider
            try {
                const result = await getGcpInsights(
                    creds.projectId || "",
                    creds.clientEmail || "",
                    creds.privateKey || ""
                );
                const list: CloudAggregateInsight[] = (result.recommendations || []).map((r: any) => ({
                    provider: prov,
                    id: r.id,
                    title: r.title,
                    category: r.category,
                    impact: r.impact,
                    resourceId: r.resourceId,
                    raw: r
                }));
                return { provider: prov, data: list, warnings: result.warning ? [result.warning] : [] };
            } catch (err: any) {
                return { provider: prov, data: [], warnings: [`GCP insights failed: ${err.message || err}`] };
            }
        }))
    );

    const data: CloudAggregateInsight[] = [];
    const warnings: string[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            data.push(...result.value.data);
            if (result.value.warnings) {
                warnings.push(...result.value.warnings);
            }
        } else {
            warnings.push(sanitizeProviderError(result.reason) || "Failed to load provider insights.");
        }
    }

    return {
        success: true,
        providers: providerSummaries as Record<CloudProvider, CloudProviderConnectionSummary>,
        data,
        warnings,
    };
}
