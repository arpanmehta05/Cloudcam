import { getOptimizationRecommendations } from "../providers/insights.provider";
import { analyzeInfrastructure } from "@modules/core";
import { logger } from "../../../core/logger";

export async function getInsights(workspaceId: string, region: string, roleArn?: string, externalId?: string) {
    // 1. Fetch AWS Compute Optimizer & Trusted Advisor recommendations
    const rawData = await getOptimizationRecommendations(workspaceId, region, roleArn, externalId);
    
    const dynamicInsights = [
        ...rawData.computeRecommendations,
        ...rawData.lambdaRecommendations,
        ...rawData.ebsRecommendations,
        ...rawData.ecsRecommendations
    ].map((r: any) => ({
        id: `opt-${r.type}-${r.resourceId}`,
        title: `${r.type.toUpperCase()} Optimization: ${r.finding}`,
        description: `Resource ${r.resourceId} is ${String(r.finding || "flagged").toLowerCase()}. Current config: ${r.currentType || r.currentMemory || r.currentCpu || "N/A"}.`,
        impact: r.finding === "Underprovisioned" || r.finding === "Overprovisioned" ? "medium" : "low",
        category: "cost",
        savings: `$${r.recommendationOptions?.[0]?.estimatedMonthlySavings || 15}/mo`,
        resourceId: r.resourceId,
        source: "compute-optimizer",
        action: r.action || `Optimize ${r.type} resource ${r.resourceId}`
    }));

    // 2. Fetch and merge Gemini AI dynamic recommendations (if enabled)
    try {
        const aiResult = await analyzeInfrastructure(workspaceId, roleArn, externalId);
        if (aiResult.success && aiResult.insights?.recommendations) {
            const aiInsights = aiResult.insights.recommendations.map((r: any) => ({
                id: r.id,
                title: r.title,
                description: r.description,
                impact: r.impact,
                category: r.category,
                savings: r.savings,
                resourceId: r.resourceId,
                source: "gemini",
                action: r.action
            }));
            dynamicInsights.push(...aiInsights);
        }
    } catch (err: unknown) {
        logger.error(`[AWS Insights] Gemini analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
        success: true,
        recommendations: dynamicInsights,
        trustedAdvisor: rawData.trustedAdvisor
    };
}
