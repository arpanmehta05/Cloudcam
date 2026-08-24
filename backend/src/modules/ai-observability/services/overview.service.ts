// ─── AI Observability: Main Analytics Service ───
// Provides overview, token trends, cost trends, model analytics,
// request detail, and error feed queries.
// All heavy aggregation runs in MongoDB — no large datasets loaded into memory.

import { AiRequestLog } from "../../../models/ai-request-log.model";
import { AiTraceSpan } from "../../../models/ai-trace-span.model";
import { AiScope, buildScopeMatch } from "./scope.service";
import { REAL_MODEL_MATCH } from "../model-usage/model-usage.service";

// ─── Shared date helpers ───

/** Parse range string (e.g. "24h", "7d", "30d", "90d") into a Date cutoff. */
export function parseDateRange(range?: string): Date {
    const cutoff = new Date();
    const normalized = (range || "7d").trim().toLowerCase();
    const dayMatch = normalized.match(/^(\d+)d$/);
    const hourMatch = normalized.match(/^(\d+)h$/);

    if (hourMatch) {
        const hours = parseInt(hourMatch[1], 10);
        cutoff.setHours(cutoff.getHours() - hours);
        return cutoff;
    }

    const days = dayMatch ? parseInt(dayMatch[1], 10) : 7;
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
}

/** Current date as YYYY-MM-DD string. */
export function todayString(): string {
    return new Date().toISOString().slice(0, 10);
}

// ─── Result interfaces ───

export interface OverviewResult {
    requestsToday: number;
    totalTokensToday: number;
    avgLatencyToday: number;
    totalCostToday: number;
    errorsToday: number;
    topProvider: string | null;
    topModel: string | null;
}

// ═══════════════════════════════════════════════════
// 1. Overview Dashboard
// ═══════════════════════════════════════════════════

export async function getOverview(scope: AiScope, provider?: string, range?: string): Promise<OverviewResult> {
    const cutoff = parseDateRange(range || "7d");
    const providerFilter = provider && provider !== "all" ? { provider } : {};
    const scopeMatch = buildScopeMatch(scope);
    // Read from spans (every real model call), matching Model Usage and
    // Cost & Tokens so the cards reconcile with the rest of the section.
    const spanMatch = { ...scopeMatch, startedAt: { $gte: cutoff }, ...REAL_MODEL_MATCH, ...providerFilter };

    const totalsAgg = await AiTraceSpan.aggregate([
        { $match: spanMatch },
        {
            $group: {
                _id: null,
                requests: { $sum: 1 },
                totalTokens: { $sum: "$totalTokens" },
                totalCost: { $sum: "$cost" },
                errors: { $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] } },
                _latencySum: { $sum: { $ifNull: ["$durationMs", 0] } },
            },
        },
    ]);

    const row = totalsAgg[0] || { requests: 0, totalTokens: 0, totalCost: 0, errors: 0, _latencySum: 0 };
    const avgLatencyToday = row.requests > 0 ? Math.round(row._latencySum / row.requests) : 0;

    // Top provider — already sorted by Mongo, just pick the first
    const topProviderAgg = await AiTraceSpan.aggregate([
        { $match: spanMatch },
        { $group: { _id: "$provider", requests: { $sum: 1 } } },
        { $sort: { requests: -1 } },
        { $limit: 1 },
    ]);

    const topModelAgg = await AiTraceSpan.aggregate([
        { $match: spanMatch },
        { $group: { _id: "$modelName", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
    ]);

    return {
        requestsToday: row.requests,
        totalTokensToday: row.totalTokens,
        avgLatencyToday,
        totalCostToday: Math.round(row.totalCost * 1_000_000) / 1_000_000,
        errorsToday: row.errors,
        topProvider: topProviderAgg[0]?._id || null,
        topModel: topModelAgg[0]?._id || null,
    };
}

// ═══════════════════════════════════════════════════
// 2. Token Trends
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// 3. Cost Trends
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// 6. Request Trace Detail
// ═══════════════════════════════════════════════════

export async function getRequestTrace(scope: AiScope, id: string) {
    const scopeMatch = buildScopeMatch(scope);
    // Try by Mongo _id first (cheap indexed lookup), fall back to requestId field
    let trace = await AiRequestLog.findOne(
        { _id: id, ...scopeMatch },
        { __v: 0 }
    ).lean().catch(() => null);

    if (!trace) {
        trace = await AiRequestLog.findOne(
            { requestId: id, ...scopeMatch },
            { __v: 0 }
        ).lean();
    }

    return trace;
}

// ═══════════════════════════════════════════════════
// 7. Trailing Averages (used by Alert Engine)
// ═══════════════════════════════════════════════════

/**
 * Computes trailing daily averages for the last N days (excluding today).
 * Returns { avgDailyCost, avgDailyTokens, avgDailyRequests, avgDailyLatency, avgDailyErrorRate }.
 * Used by the alert rules engine to detect spikes.
 */
export async function getTrailingAverages(scope: AiScope, trailingDays: number = 7) {
    // Read from spans (every real model call) so the alert/anomaly engines see
    // the same activity as Overview/Cost/Model — otherwise they fire false
    // "requests near zero" alerts when traffic is non-llm spans.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const cutoff = new Date(startOfToday);
    cutoff.setDate(cutoff.getDate() - trailingDays);

    const perDay = await AiTraceSpan.aggregate([
        {
            $match: {
                ...buildScopeMatch(scope),
                ...REAL_MODEL_MATCH,
                startedAt: { $gte: cutoff, $lt: startOfToday },
            },
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
                cost: { $sum: "$cost" },
                tokens: { $sum: "$totalTokens" },
                requests: { $sum: 1 },
                errors: { $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] } },
                _latencySum: { $sum: { $ifNull: ["$durationMs", 0] } },
            },
        },
    ]);

    const dayCount = perDay.length || 1; // Avoid division by zero
    const totals = perDay.reduce(
        (acc, row) => ({
            cost: acc.cost + row.cost,
            tokens: acc.tokens + row.tokens,
            requests: acc.requests + row.requests,
            errors: acc.errors + row.errors,
            latencySum: acc.latencySum + row._latencySum,
        }),
        { cost: 0, tokens: 0, requests: 0, errors: 0, latencySum: 0 }
    );

    return {
        avgDailyCost: totals.cost / dayCount,
        avgDailyTokens: totals.tokens / dayCount,
        avgDailyRequests: totals.requests / dayCount,
        avgDailyLatency: totals.requests > 0 ? totals.latencySum / totals.requests : 0,
        avgDailyErrorRate: totals.requests > 0 ? totals.errors / totals.requests : 0,
    };
}

/**
 * Get today's aggregated stats for spike comparison.
 */
export async function getTodayStats(scope: AiScope) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const agg = await AiTraceSpan.aggregate([
        {
            $match: {
                ...buildScopeMatch(scope),
                ...REAL_MODEL_MATCH,
                startedAt: { $gte: startOfToday },
            },
        },
        {
            $group: {
                _id: null,
                cost: { $sum: "$cost" },
                tokens: { $sum: "$totalTokens" },
                requests: { $sum: 1 },
                errors: { $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] } },
                _latencySum: { $sum: { $ifNull: ["$durationMs", 0] } },
            },
        },
    ]);

    const row = agg[0] || { cost: 0, tokens: 0, requests: 0, errors: 0, _latencySum: 0 };
    return {
        cost: row.cost,
        tokens: row.tokens,
        requests: row.requests,
        errors: row.errors,
        avgLatency: row.requests > 0 ? row._latencySum / row.requests : 0,
        errorRate: row.requests > 0 ? row.errors / row.requests : 0,
    };
}
