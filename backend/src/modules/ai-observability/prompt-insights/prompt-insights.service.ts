import { AiRequestLog } from "../../../models/ai-request-log.model";

export interface PromptInsight {
    endpoint: string | null;
    serviceName: string | null;
    avgPromptTokens: number;
    avgCompletionTokens: number;
    promptRatio: number;
    requestCount: number;
    insightType: "fixed_prompt" | "prompt_completion_imbalance" | "duplicate_context";
    estimatedTokenSavings: number;
    estimatedCostSavings: number;
    message: string;
}

function monthlyTokenSavings(avgPromptTokens: number, requests: number, rangeDays: number, compressionRate: number) {
    return Math.round(avgPromptTokens * compressionRate * requests * (30 / Math.max(rangeDays, 1)));
}

function monthlyCostSavings(totalCost: number, rangeDays: number, inputShare: number, compressionRate: number) {
    return Math.round(totalCost * (30 / Math.max(rangeDays, 1)) * inputShare * compressionRate * 100) / 100;
}

export async function generatePromptInsights(userId: string, rangeDays: number = 7): Promise<PromptInsight[]> {
    const days = Math.min(Math.max(rangeDays, 1), 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const groups = await AiRequestLog.aggregate([
        { $match: { userId, createdAt: { $gte: cutoff }, status: "success" } },
        {
            $group: {
                _id: { endpoint: "$endpoint", serviceName: "$serviceName" },
                requestCount: { $sum: 1 },
                avgPromptTokens: { $avg: "$promptTokens" },
                avgCompletionTokens: { $avg: "$completionTokens" },
                totalPromptTokens: { $sum: "$promptTokens" },
                totalCompletionTokens: { $sum: "$completionTokens" },
                totalCost: { $sum: "$cost" },
                sumSqPromptTokens: { $sum: { $multiply: ["$promptTokens", "$promptTokens"] } },
            },
        },
        { $match: { requestCount: { $gte: 3 }, avgPromptTokens: { $gte: 250 } } },
        { $sort: { totalPromptTokens: -1 } },
        { $limit: 60 },
    ]);

    const insights: PromptInsight[] = [];

    for (const row of groups as any[]) {
        const endpoint = row._id.endpoint || null;
        const serviceName = row._id.serviceName || null;
        const requestCount = row.requestCount || 0;
        const avgPrompt = row.avgPromptTokens || 0;
        const avgCompletion = row.avgCompletionTokens || 0;
        const totalTokens = Math.max((row.totalPromptTokens || 0) + (row.totalCompletionTokens || 0), 1);
        const inputShare = Math.min(0.95, Math.max(0.1, (row.totalPromptTokens || 0) / totalTokens));
        const variance = (row.sumSqPromptTokens || 0) / Math.max(requestCount, 1) - avgPrompt * avgPrompt;
        const stddev = Math.sqrt(Math.max(0, variance));
        const coefficientOfVariation = avgPrompt > 0 ? stddev / avgPrompt : 0;

        if (coefficientOfVariation <= 0.15 && avgPrompt >= 450 && requestCount >= 5) {
            const compressionRate = 0.45;
            insights.push({
                endpoint,
                serviceName,
                avgPromptTokens: Math.round(avgPrompt),
                avgCompletionTokens: Math.round(avgCompletion),
                promptRatio: avgCompletion > 0 ? Math.round(avgPrompt / avgCompletion) : 0,
                requestCount,
                insightType: "fixed_prompt",
                estimatedTokenSavings: monthlyTokenSavings(avgPrompt, requestCount, days, compressionRate),
                estimatedCostSavings: monthlyCostSavings(row.totalCost || 0, days, inputShare, compressionRate),
                message: `Stable prompt around ${Math.round(avgPrompt).toLocaleString()} tokens. Move repeated policy/context into a reusable template or prompt cache.`,
            });
        }

        if (avgCompletion > 0 && avgPrompt / avgCompletion >= 8) {
            const compressionRate = 0.35;
            insights.push({
                endpoint,
                serviceName,
                avgPromptTokens: Math.round(avgPrompt),
                avgCompletionTokens: Math.round(avgCompletion),
                promptRatio: Math.round(avgPrompt / avgCompletion),
                requestCount,
                insightType: "prompt_completion_imbalance",
                estimatedTokenSavings: monthlyTokenSavings(avgPrompt, requestCount, days, compressionRate),
                estimatedCostSavings: monthlyCostSavings(row.totalCost || 0, days, inputShare, compressionRate),
                message: `Prompt is ${Math.round(avgPrompt / avgCompletion)}x larger than completion. Limit retrieved context and send only fields needed by the task.`,
            });
        }
    }

    const byService = new Map<string, any[]>();
    for (const row of groups as any[]) {
        const key = row._id.serviceName || "unknown";
        byService.set(key, [...(byService.get(key) || []), row]);
    }

    for (const [serviceName, rows] of byService) {
        if (serviceName === "unknown" || rows.length < 2) continue;
        const sorted = rows.slice().sort((a, b) => (b.avgPromptTokens || 0) - (a.avgPromptTokens || 0));
        const [first, second] = sorted;
        const avgA = first.avgPromptTokens || 0;
        const avgB = second.avgPromptTokens || 0;
        const spread = Math.abs(avgA - avgB) / Math.max(avgA, avgB, 1);
        if (avgA >= 350 && spread <= 0.2) {
            const requestCount = (first.requestCount || 0) + (second.requestCount || 0);
            const totalCost = (first.totalCost || 0) + (second.totalCost || 0);
            insights.push({
                endpoint: `${first._id.endpoint || "endpoint-a"} <-> ${second._id.endpoint || "endpoint-b"}`,
                serviceName,
                avgPromptTokens: Math.round((avgA + avgB) / 2),
                avgCompletionTokens: Math.round(((first.avgCompletionTokens || 0) + (second.avgCompletionTokens || 0)) / 2),
                promptRatio: 0,
                requestCount,
                insightType: "duplicate_context",
                estimatedTokenSavings: monthlyTokenSavings((avgA + avgB) / 2, requestCount, days, 0.25),
                estimatedCostSavings: monthlyCostSavings(totalCost, days, 0.7, 0.25),
                message: `Similar large prompts across two ${serviceName} endpoints. Consolidate shared system context and pass endpoint-specific deltas only.`,
            });
        }
    }

    const unique = new Map<string, PromptInsight>();
    for (const insight of insights) {
        const key = `${insight.endpoint}-${insight.insightType}`;
        if (!unique.has(key) || unique.get(key)!.estimatedCostSavings < insight.estimatedCostSavings) {
            unique.set(key, insight);
        }
    }

    return [...unique.values()].sort((a, b) => b.estimatedCostSavings - a.estimatedCostSavings).slice(0, 12);
}
