// ─── AI Observability: Summary & Insights Service ───
// Generates daily executive summaries and weekly optimization insights.
// Uses AiDailyMetric aggregation for efficiency.

import { AiDailyMetric } from "../../../models/ai-daily-metric.model";
import { AiRequestLog } from "../../../models/ai-request-log.model";
import { AiAlert } from "../../../models/ai-alert.model";

// ─── Helpers ───

function dateString(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
}

function monthStartString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Daily Summary ───

export interface DailySummary {
    date: string;
    requests: number;
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
    errorCount: number;
    errorRate: number;
    topProvider: string | null;
    topModel: string | null;
    bestLatencyProvider: string | null;
    alertsTriggered: number;
    costChangePercent: number | null; // vs prior day
    narrative: string; // Human-readable summary
    generatedAt: string;
}

/**
 * Generate executive summary for a specific date (default: yesterday).
 */
export async function generateDailySummary(userId: string, forDate?: string): Promise<DailySummary> {
    const targetDate = forDate || dateString(1); // yesterday
    const priorDate = (() => {
        const d = new Date(targetDate);
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    })();

    // Target day aggregation
    const dayAgg = await AiDailyMetric.aggregate([
        { $match: { userId, date: targetDate } },
        {
            $group: {
                _id: null,
                requests: { $sum: "$requests" },
                totalTokens: { $sum: "$totalTokens" },
                totalCost: { $sum: "$totalCost" },
                errors: { $sum: "$errorCount" },
                _latencySum: { $sum: { $multiply: ["$avgLatencyMs", "$requests"] } },
                _requestsSum: { $sum: "$requests" },
            },
        },
    ]);

    const row = dayAgg[0] || { requests: 0, totalTokens: 0, totalCost: 0, errors: 0, _latencySum: 0, _requestsSum: 0 };
    const avgLatency = row._requestsSum > 0 ? Math.round(row._latencySum / row._requestsSum) : 0;
    const errorRate = row.requests > 0 ? row.errors / row.requests : 0;

    // Prior day cost for comparison
    const priorAgg = await AiDailyMetric.aggregate([
        { $match: { userId, date: priorDate } },
        { $group: { _id: null, totalCost: { $sum: "$totalCost" } } },
    ]);
    const priorCost = priorAgg[0]?.totalCost || 0;
    const costChangePercent = priorCost > 0
        ? Math.round(((row.totalCost - priorCost) / priorCost) * 100)
        : null;

    // Top provider (by requests)
    const topProviderAgg = await AiDailyMetric.aggregate([
        { $match: { userId, date: targetDate } },
        { $sort: { requests: -1 } },
        { $limit: 1 },
    ]);
    const topProvider = topProviderAgg[0]?.provider || null;

    // Best latency provider
    const bestLatencyAgg = await AiDailyMetric.aggregate([
        { $match: { userId, date: targetDate, requests: { $gt: 0 } } },
        { $sort: { avgLatencyMs: 1 } },
        { $limit: 1 },
    ]);
    const bestLatencyProvider = bestLatencyAgg[0]?.provider || null;

    // Top model (from request logs)
    const topModelAgg = await AiRequestLog.aggregate([
        { $match: { userId, createdAt: { $gte: new Date(targetDate), $lt: new Date(new Date(targetDate).getTime() + 86400000) } } },
        { $group: { _id: "$modelName", count: { $sum: 1 }, cost: { $sum: "$cost" } } },
        { $sort: { cost: -1 } },
        { $limit: 1 },
    ]);
    const topModel = topModelAgg[0]?._id || null;

    // Alerts triggered that day
    const alertCount = await AiAlert.countDocuments({
        userId,
        createdAt: {
            $gte: new Date(targetDate),
            $lt: new Date(new Date(targetDate).getTime() + 86400000),
        },
    });

    // Build narrative
    const parts: string[] = [];
    parts.push(`${row.requests.toLocaleString()} requests processed`);
    parts.push(`$${row.totalCost.toFixed(2)} total spend${costChangePercent !== null ? ` (${costChangePercent > 0 ? "+" : ""}${costChangePercent}% vs prior day)` : ""}`);
    if (topModel) parts.push(`${topModel} was the highest-cost model`);
    parts.push(`Error rate: ${(errorRate * 100).toFixed(1)}%`);
    if (bestLatencyProvider) parts.push(`${bestLatencyProvider} had the best latency`);
    if (alertCount > 0) parts.push(`${alertCount} alert${alertCount > 1 ? "s" : ""} triggered`);

    const narrative = `AI Usage Summary (${targetDate}):\n- ${parts.join("\n- ")}`;

    return {
        date: targetDate,
        requests: row.requests,
        totalTokens: row.totalTokens,
        totalCost: Math.round(row.totalCost * 100) / 100,
        avgLatency,
        errorCount: row.errors,
        errorRate: Math.round(errorRate * 1000) / 1000,
        topProvider,
        topModel,
        bestLatencyProvider,
        alertsTriggered: alertCount,
        costChangePercent,
        narrative,
        generatedAt: new Date().toISOString(),
    };
}

// ─── Weekly Insights ───

export interface WeeklyInsight {
    type: "optimization" | "risk" | "trend" | "recommendation";
    title: string;
    message: string;
    priority: "low" | "medium" | "high";
    metadata?: Record<string, any>;
}

export interface WeeklySummary {
    weekStart: string;
    weekEnd: string;
    totalRequests: number;
    totalCost: number;
    totalTokens: number;
    insights: WeeklyInsight[];
    generatedAt: string;
}

/**
 * Generate weekly optimization insights.
 * Analyzes last 7 days of data and produces actionable recommendations.
 */
export async function generateWeeklySummary(userId: string): Promise<WeeklySummary> {
    const weekEnd = dateString(0);   // today
    const weekStart = dateString(7); // 7 days ago

    // Weekly totals
    const weekAgg = await AiDailyMetric.aggregate([
        { $match: { userId, date: { $gte: weekStart, $lte: weekEnd } } },
        {
            $group: {
                _id: null,
                requests: { $sum: "$requests" },
                totalTokens: { $sum: "$totalTokens" },
                totalCost: { $sum: "$totalCost" },
                errors: { $sum: "$errorCount" },
            },
        },
    ]);
    const totals = weekAgg[0] || { requests: 0, totalTokens: 0, totalCost: 0, errors: 0 };

    // Model-level breakdown
    const modelBreakdown = await AiRequestLog.aggregate([
        { $match: { userId, createdAt: { $gte: new Date(weekStart) } } },
        {
            $group: {
                _id: { model: "$modelName", provider: "$provider" },
                requests: { $sum: 1 },
                totalTokens: { $sum: "$totalTokens" },
                totalCost: { $sum: "$cost" },
                avgLatency: { $avg: "$latencyMs" },
                errors: { $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] } },
            },
        },
        { $sort: { totalCost: -1 } },
    ]);

    // Provider breakdown
    const providerBreakdown = await AiDailyMetric.aggregate([
        { $match: { userId, date: { $gte: weekStart, $lte: weekEnd } } },
        {
            $group: {
                _id: "$provider",
                requests: { $sum: "$requests" },
                totalCost: { $sum: "$totalCost" },
                errors: { $sum: "$errorCount" },
            },
        },
        { $sort: { totalCost: -1 } },
    ]);

    // ── Generate insights ──
    const insights: WeeklyInsight[] = [];

    // Insight 1: High-cost model optimization
    const expensiveModels = modelBreakdown.filter((m: any) => m.totalCost > totals.totalCost * 0.4);
    for (const m of expensiveModels) {
        const tokenPer$ = m.totalCost > 0 ? Math.round(m.totalTokens / m.totalCost) : 0;
        insights.push({
            type: "optimization",
            title: `${m._id.model} accounts for ${Math.round((m.totalCost / (totals.totalCost || 1)) * 100)}% of spend`,
            message: `Consider routing low-priority traffic to a cheaper alternative. Efficiency: ${tokenPer$.toLocaleString()} tokens/$. ${m.requests} requests this week.`,
            priority: m.totalCost > totals.totalCost * 0.6 ? "high" : "medium",
            metadata: { model: m._id.model, provider: m._id.provider, cost: m.totalCost, requests: m.requests },
        });
    }

    // Insight 2: High latency models
    const highLatencyModels = modelBreakdown.filter((m: any) => m.avgLatency > 5000 && m.requests > 10);
    for (const m of highLatencyModels) {
        insights.push({
            type: "recommendation",
            title: `${m._id.model} has high average latency (${Math.round(m.avgLatency)}ms)`,
            message: `Consider switching to a faster model or provider for latency-sensitive workloads.`,
            priority: m.avgLatency > 10000 ? "high" : "medium",
            metadata: { model: m._id.model, avgLatency: m.avgLatency },
        });
    }

    // Insight 3: High error rate models
    const highErrorModels = modelBreakdown.filter((m: any) => m.requests > 5 && (m.errors / m.requests) > 0.1);
    for (const m of highErrorModels) {
        insights.push({
            type: "risk",
            title: `${m._id.model} has ${Math.round((m.errors / m.requests) * 100)}% error rate`,
            message: `${m.errors} out of ${m.requests} requests failed. Review error patterns.`,
            priority: (m.errors / m.requests) > 0.3 ? "high" : "medium",
            metadata: { model: m._id.model, errors: m.errors, requests: m.requests },
        });
    }

    // Insight 4: Provider concentration risk
    if (providerBreakdown.length > 0) {
        const topProvider = providerBreakdown[0];
        const topPct = totals.totalCost > 0 ? (topProvider.totalCost / totals.totalCost) * 100 : 0;
        if (topPct > 80) {
            insights.push({
                type: "risk",
                title: `${topPct.toFixed(0)}% of spend concentrated on ${topProvider._id}`,
                message: `Single-provider dependency creates outage risk. Consider distributing across providers.`,
                priority: topPct > 90 ? "high" : "medium",
                metadata: { provider: topProvider._id, spendPercent: topPct },
            });
        }
    }

    // Insight 5: Cost trend direction
    const firstHalf = await AiDailyMetric.aggregate([
        { $match: { userId, date: { $gte: weekStart, $lt: dateString(3) } } },
        { $group: { _id: null, cost: { $sum: "$totalCost" } } },
    ]);
    const secondHalf = await AiDailyMetric.aggregate([
        { $match: { userId, date: { $gte: dateString(3), $lte: weekEnd } } },
        { $group: { _id: null, cost: { $sum: "$totalCost" } } },
    ]);
    const firstCost = firstHalf[0]?.cost || 0;
    const secondCost = secondHalf[0]?.cost || 0;
    if (firstCost > 0 && secondCost > firstCost * 1.3) {
        insights.push({
            type: "trend",
            title: "AI spend is accelerating",
            message: `Second half of the week cost $${secondCost.toFixed(2)} vs $${firstCost.toFixed(2)} in the first half (+${Math.round(((secondCost - firstCost) / firstCost) * 100)}%).`,
            priority: secondCost > firstCost * 2 ? "high" : "medium",
        });
    }

    return {
        weekStart,
        weekEnd,
        totalRequests: totals.requests,
        totalCost: Math.round(totals.totalCost * 100) / 100,
        totalTokens: totals.totalTokens,
        insights,
        generatedAt: new Date().toISOString(),
    };
}

// ─── Prompt Compression Insights ───

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

/**
 * Find prompts that are unnecessarily large and suggest compression.
 * Analyzes prompt size patterns per endpoint.
 */
export async function generatePromptInsights(
    userId: string,
    rangeDays: number = 7
): Promise<PromptInsight[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);

    // First pass: aggregate by endpoint (mean prompt/completion tokens, count, sum of squares for stddev)
    const groups = await AiRequestLog.aggregate([
        { $match: { userId, createdAt: { $gte: cutoff } } },
        {
            $group: {
                _id: { endpoint: "$endpoint", service: "$serviceName" },
                requestCount: { $sum: 1 },
                avgPromptTokens: { $avg: "$promptTokens" },
                avgCompletionTokens: { $avg: "$completionTokens" },
                sumPromptTokens: { $sum: "$promptTokens" },
                sumSqPromptTokens: { $sum: { $multiply: ["$promptTokens", "$promptTokens"] } },
                totalCost: { $sum: "$cost" },
                totalPromptTokens: { $sum: "$promptTokens" },
            },
        },
        { $match: { requestCount: { $gte: 5 } } },
        { $sort: { requestCount: -1 } },
    ]);

    if (groups.length === 0) return [];

    const insights: PromptInsight[] = [];

    for (const g of groups as any[]) {
        const endpoint = g._id.endpoint;
        const service = g._id.service;
        const n = g.requestCount;
        const meanPrompt = g.avgPromptTokens;
        const meanCompletion = g.avgCompletionTokens;

        // Compute standard deviation: sqrt(E[X^2] - (E[X])^2)
        const variance = g.sumSqPromptTokens / n - meanPrompt * meanPrompt;
        const stddev = Math.sqrt(Math.max(0, variance));
        const cv = meanPrompt > 0 ? stddev / meanPrompt : 0; // coefficient of variation

        // Rule 1: Large fixed prompt — low variance relative to mean
        if (cv < 0.1 && meanPrompt > 500 && n >= 10) {
            const estimatedSavings = Math.round(meanPrompt * 0.5 * n / rangeDays * 30); // 50% compression potential
            insights.push({
                endpoint,
                serviceName: service || null,
                avgPromptTokens: Math.round(meanPrompt),
                avgCompletionTokens: Math.round(meanCompletion),
                promptRatio: meanCompletion > 0 ? Math.round(meanPrompt / meanCompletion) : 0,
                requestCount: n,
                insightType: "fixed_prompt",
                estimatedTokenSavings: estimatedSavings,
                estimatedCostSavings: 0,
                message: `Fixed system prompt of ~${Math.round(meanPrompt).toLocaleString()} tokens detected (variance: ${(cv * 100).toFixed(0)}%). Compress to ~${Math.round(meanPrompt * 0.5).toLocaleString()} tokens to save ${estimatedSavings.toLocaleString()} tokens/day.`,
            });
        }

        // Rule 2: Prompt/completion imbalance — prompt > 10x completion
        if (meanCompletion > 0 && meanPrompt > meanCompletion * 10) {
            const ratio = Math.round(meanPrompt / meanCompletion);
            insights.push({
                endpoint,
                serviceName: service || null,
                avgPromptTokens: Math.round(meanPrompt),
                avgCompletionTokens: Math.round(meanCompletion),
                promptRatio: ratio,
                requestCount: n,
                insightType: "prompt_completion_imbalance",
                estimatedTokenSavings: Math.round(meanPrompt * 0.5 * n / rangeDays * 30),
                estimatedCostSavings: 0,
                message: `Prompt is ${ratio}× larger than completion. ${Math.round((1 - meanCompletion / meanPrompt) * 100)}% of your prompt budget is wasted on this endpoint.`,
            });
        }
    }

    // Rule 3: Duplicate context — same service, similar prompt sizes across endpoints
    const byService = new Map<string, any[]>();
    for (const g of groups) {
        const key = (g as any)._id.service || "unknown";
        if (!byService.has(key)) byService.set(key, []);
        byService.get(key)!.push(g);
    }

    for (const [, endpoints] of byService) {
        if (endpoints.length < 2) continue;
        for (let i = 0; i < endpoints.length; i++) {
            for (let j = i + 1; j < endpoints.length; j++) {
                const a = endpoints[i] as any;
                const b = endpoints[j] as any;
                const aPrompt = a.avgPromptTokens;
                const bPrompt = b.avgPromptTokens;
                const diff = Math.abs(aPrompt - bPrompt) / Math.max(aPrompt, bPrompt, 1);

                if (diff < 0.2 && aPrompt > 300) {
                    insights.push({
                        endpoint: `${a._id.endpoint || "?"} ↔ ${b._id.endpoint || "?"}`,
                        serviceName: a._id.service || null,
                        avgPromptTokens: Math.round((aPrompt + bPrompt) / 2),
                        avgCompletionTokens: Math.round((a.avgCompletionTokens + b.avgCompletionTokens) / 2),
                        promptRatio: 0,
                        requestCount: a.requestCount + b.requestCount,
                        insightType: "duplicate_context",
                        estimatedTokenSavings: Math.round(aPrompt * a.requestCount / rangeDays * 30),
                        estimatedCostSavings: 0,
                        message: `Same ~${Math.round(aPrompt).toLocaleString()} token system prompt duplicated across ${a._id.endpoint || "?"} and ${b._id.endpoint || "?"}. Consolidate into a shared prompt template.`,
                    });
                }
            }
        }
    }

    return insights.sort((a, b) => b.estimatedTokenSavings - a.estimatedTokenSavings);
}
