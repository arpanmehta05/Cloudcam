import { CloudProvider } from "../../../models/aws.model";
import {
    CloudRecommendationHubDiagnosis,
    CloudRecommendationHubItem,
    CloudRecommendationHubOptimization,
    CloudRecommendationHubResponse,
    NormalizedCloudResource,
    CloudAggregateInsight,
} from "../../../providers/cloud/types";
import { getAggregateCloudResources } from "./resources.service";
import { selectedProviders, normalizeHubRecommendation, warningsForProvider } from "./aggregate/helpers";
import { generateMulticloudAiInsights } from "./ai-recommendations.service";
import { MemoryCache } from "../../../core/cache/memory-cache";

// Import sub-aggregators
import { getAggregateCloudBilling } from "./aggregate/billing";
import { getAggregateCloudSecurity, getAggregateCloudInsights } from "./aggregate/security";

// Re-export all sub-aggregators so external modules can import them from this file
export { getAggregateCloudBilling } from "./aggregate/billing";
export { getAggregateCloudSecurity, getAggregateCloudInsights } from "./aggregate/security";
export { getAggregateCloudMetrics, getAggregateCloudLogs } from "./aggregate/resources";


const recommendationHubCache = new MemoryCache<CloudRecommendationHubResponse>(5 * 60 * 1000);
const activeHubQueries = new Map<string, Promise<CloudRecommendationHubResponse>>();

async function runAndCacheCloudRecommendationHub(
    userId: string,
    provider: CloudProvider | "all",
    region: string,
    forceRefresh: boolean
): Promise<CloudRecommendationHubResponse> {
    const cacheKey = `${userId}:${provider}:${region}:${forceRefresh}`;
    let activePromise = activeHubQueries.get(cacheKey);

    if (!activePromise) {
        activePromise = (async () => {
            const [resourcesResult, billingResult, securityResult, insightsResult] = await Promise.all([
                getAggregateCloudResources(userId, provider, region, forceRefresh),
                getAggregateCloudBilling(userId, provider, "24h", forceRefresh),
                getAggregateCloudSecurity(userId, provider, region),
                getAggregateCloudInsights(userId, provider, region),
            ]);

            const providers = insightsResult.providers;
            const allWarnings = [resourcesResult, billingResult, securityResult, insightsResult]
                .flatMap((result) => result.warnings || [])
                .filter(Boolean);
            const visibleWarnings = allWarnings.filter((warning) => !warning.toLowerCase().includes("not connected"));
            const recommendations = insightsResult.data.map(normalizeHubRecommendation);
            const targetProviders = selectedProviders(provider);

            const diagnosis: CloudRecommendationHubDiagnosis[] = targetProviders.map((prov) => {
                const connection = providers[prov];
                const providerWarnings = [
                    ...(connection?.warnings || []),
                    ...warningsForProvider(prov, allWarnings),
                ];
                const providerRecommendations = recommendations.filter((item) => item.provider === prov).length;
                const providerSecurity = securityResult.data.find((item) => item.provider === prov);
                const findings = Number(providerSecurity?.findingsCount || 0);
                const label = prov === "aws" ? "AWS" : prov === "azure" ? "Azure" : "GCP";

                if (!connection?.connected) {
                    return {
                        provider: prov,
                        title: `${label} not connected`,
                        status: "warning",
                        details: `Connect ${label} to include its provider-native recommendations in this insights hub.`,
                    };
                }

                if (providerWarnings.length > 0) {
                    return {
                        provider: prov,
                        title: `${label} needs attention`,
                        status: "warning",
                        details: providerWarnings[0],
                    };
                }

                return {
                    provider: prov,
                    title: `${label} analysis ready`,
                    status: findings > 0 ? "warning" : "healthy",
                    details: `${providerRecommendations} recommendations and ${findings} security findings are available from connected provider data.`,
                };
            });

            const optimizations: CloudRecommendationHubOptimization[] = recommendations
                .filter((item) => ["cost", "performance", "optimization"].includes(item.category.toLowerCase()))
                .map((item) => ({
                    id: `opt:${item.id}`,
                    provider: item.provider,
                    title: item.title,
                    description: item.description,
                    priority: item.impact,
                    effort: item.provider === "aws" ? "medium" : "low",
                    savings: item.savings,
                    action: item.action,
                }));

            const aiInsights = forceRefresh
                ? await generateMulticloudAiInsights(
                      resourcesResult.data as NormalizedCloudResource[],
                      billingResult.data,
                      securityResult.data,
                      recommendations
                  )
                : null;

            if (aiInsights) {
                // 1. Merge AI Recommendations
                aiInsights.recommendations.forEach((rec) => {
                    recommendations.unshift({
                        id: `ai:${rec.id}`,
                        provider: rec.provider,
                        title: rec.title,
                        description: rec.description,
                        impact: rec.impact,
                        category: rec.category,
                        savings: rec.savings,
                        action: rec.action,
                        resourceId: rec.resourceId,
                        source: "gemini",
                        raw: rec
                    });
                });

                // 2. Merge AI Diagnosis
                aiInsights.diagnosis.forEach((diag) => {
                    diagnosis.unshift({
                        provider: diag.provider,
                        title: `AI finding: ${diag.title}`,
                        status: diag.status,
                        details: diag.details
                    });
                });

                // 3. Merge AI Optimizations
                aiInsights.optimizations.forEach((opt) => {
                    optimizations.unshift({
                        id: `ai-opt:${opt.id}`,
                        provider: opt.provider,
                        title: opt.title,
                        description: opt.description,
                        priority: opt.priority,
                        effort: opt.effort,
                        savings: opt.savings,
                        action: opt.action
                    });
                });
            }

            return {
                success: true as const,
                providers,
                insights: {
                    recommendations,
                    diagnosis,
                    optimizations,
                    warnings: Array.from(new Set(visibleWarnings)),
                },
                metrics: {
                    resources: resourcesResult.data as NormalizedCloudResource[],
                    billing: billingResult.data,
                    security: securityResult.data,
                },
                generatedAt: new Date().toISOString(),
                warnings: Array.from(new Set(visibleWarnings)),
            };
        })();

        activeHubQueries.set(cacheKey, activePromise);
    }

    try {
        const result = await activePromise;
        recommendationHubCache.set(`${userId}:${provider}:${region}`, result);
        return result;
    } finally {
        activeHubQueries.delete(cacheKey);
    }
}

export async function getCloudRecommendationHub(
    userId: string,
    provider: CloudProvider | "all",
    region: string,
    forceRefresh: boolean = false
): Promise<CloudRecommendationHubResponse> {
    const cacheKey = `${userId}:${provider}:${region}`;
    const cached = recommendationHubCache.get(cacheKey);

    if (cached) {
        const isSyncing = activeHubQueries.has(`${userId}:${provider}:${region}:true`);
        if (forceRefresh) {
            console.log(`[getCloudRecommendationHub] Serving stale-while-revalidate cache for user ${userId}. Kicking off background update...`);
            runAndCacheCloudRecommendationHub(userId, provider, region, true).catch((err) => {
                console.error(`[getCloudRecommendationHub] Background update failed for user ${userId}:`, err);
            });
            return {
                ...cached,
                syncInProgress: true
            };
        } else {
            console.log(`[getCloudRecommendationHub] Serving fresh cache for user ${userId}.`);
            return {
                ...cached,
                syncInProgress: isSyncing
            };
        }
    }

    console.log(`[getCloudRecommendationHub] Cache miss for user ${userId}. Fetching fast path synchronously, then backgrounding fresh sync...`);
    const fastResult = await runAndCacheCloudRecommendationHub(userId, provider, region, false);

    // Trigger full fresh update in the background
    runAndCacheCloudRecommendationHub(userId, provider, region, true).catch((err) => {
        console.error(`[getCloudRecommendationHub] Background cache miss sync failed for user ${userId}:`, err);
    });

    return {
        ...fastResult,
        syncInProgress: true
    };
}
