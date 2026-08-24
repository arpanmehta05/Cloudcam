import {
    CloudProvider,
    CloudProviderConnectionSummary,
    CloudAggregateInsight,
    CloudRecommendationHubItem,
} from "../../../../providers/cloud/types";
import { getCloudProviderIds } from "../../../../providers/cloud/registry";
import { getAllProviderConnectionSummaries } from "../capabilities.service";

export function selectedProviders(
    provider: CloudProvider | "all",
    providerSummaries?: Record<CloudProvider, CloudProviderConnectionSummary>
): CloudProvider[] {
    const list = provider === "all" ? getCloudProviderIds() : [provider];
    if (providerSummaries) {
        return list.filter(p => providerSummaries[p]?.connected);
    }
    return list;
}

export function capabilityWarning(provider: CloudProvider, capability: string): string {
    return `${provider} ${capability} aggregation is scaffolded and will be wired in its provider phase.`;
}

export function normalizeImpact(value: unknown): "high" | "medium" | "low" {
    const impact = String(value || "medium").toLowerCase();
    if (impact === "high") return "high";
    if (impact === "low") return "low";
    return "medium";
}

export function estimateSavings(raw: any): string | undefined {
    if (raw?.savings) return String(raw.savings);
    const savingsPercentage = Number(raw?.savingsPercentage || 0);
    if (savingsPercentage > 0) return `${Math.round(savingsPercentage)}%`;
    return undefined;
}

export function providerActionLabel(provider: CloudProvider, raw: any, category: string): string {
    if (raw?.action) return String(raw.action);
    if (provider === "azure") return category === "security" ? "Review in Azure Advisor and Defender" : "Review in Azure Advisor";
    if (provider === "gcp") return category === "security" ? "Review in Security Command Center" : "Review in Google Cloud Recommender";
    return "Review optimization evidence";
}

export function warningsForProvider(provider: CloudProvider, warnings: string[]): string[] {
    const providerName = provider.toLowerCase();
    const providerLabel: Record<CloudProvider, string> = {
        aws: "amazon",
        azure: "azure",
        gcp: "google",
    };
    return warnings.filter((warning) => {
        const lower = warning.toLowerCase();
        return lower.includes(providerName) || lower.includes(providerLabel[provider]);
    });
}

export async function emptyAggregate<T>(
    userId: string,
    provider: CloudProvider | "all",
    capability: string
): Promise<{
    success: boolean;
    providers: Record<CloudProvider, CloudProviderConnectionSummary>;
    data: T[];
    warnings: string[];
}> {
    const providers = await getAllProviderConnectionSummaries(userId);
    return {
        success: true,
        providers,
        data: [],
        warnings: selectedProviders(provider).map(item => capabilityWarning(item, capability)),
    };
}

export function normalizeHubRecommendation(item: CloudAggregateInsight): CloudRecommendationHubItem {
    const raw: any = item.raw || item;
    const category = String(item.category || raw.category || "optimization");
    const resourceId = item.resourceId || raw.resourceId;
    const actionPlan = raw.actionPlan;

    return {
        id: `${item.provider}:${item.id || raw.id || item.title}`,
        provider: item.provider,
        title: String(item.title || raw.title || "Provider recommendation"),
        description: String(raw.description || (resourceId ? `Resource ${resourceId} has a provider recommendation.` : "Provider recommendation is available for review.")),
        impact: normalizeImpact(item.impact || raw.impact),
        category,
        savings: estimateSavings(raw),
        action: providerActionLabel(item.provider, raw, category),
        resourceId,
        source: raw.source,
        actionPlan: actionPlan && typeof actionPlan === "object" ? actionPlan : undefined,
        raw,
    };
}
