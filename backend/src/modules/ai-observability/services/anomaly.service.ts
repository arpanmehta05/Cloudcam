// ─── AI Observability: Anomaly Detection Service ───
// Lightweight statistical rules for detecting unusual AI usage patterns.
// No ML required — uses trailing averages + threshold-based detection.
// Designed to be called by cron jobs or on-demand via API.

import { AiRequestLog } from "../../../models/ai-request-log.model";
import { AiDailyMetric } from "../../../models/ai-daily-metric.model";
import { getTrailingAverages, getTodayStats, todayString } from "./overview.service";
import { AiScope, buildScopeMatch } from "./scope.service";

// ─── Thresholds ───

const COST_SPIKE_MULTIPLIER = 1.5;       // 150% of trailing avg
const TOKEN_SPIKE_MULTIPLIER = 1.5;
const ERROR_RATE_THRESHOLD = 0.10;       // 10% absolute
const ERROR_RATE_SPIKE_MULTIPLIER = 2.0; // 2× trailing avg
const LATENCY_SPIKE_MULTIPLIER = 2.0;    // 2× trailing avg
const SILENT_FAILURE_MIN_TRAILING = 10;  // Must have ≥10 avg daily requests to detect
const SILENT_FAILURE_THRESHOLD = 0.1;    // <10% of trailing avg = suspicious
const PROVIDER_OUTAGE_MIN_ERRORS = 5;    // Min errors to trigger outage suspicion
const PROVIDER_OUTAGE_ERROR_RATE = 0.5;  // 50% error rate on single provider

// ─── Anomaly Types ───

export type AnomalyType =
    | "cost_spike"
    | "token_spike"
    | "error_spike"
    | "latency_spike"
    | "silent_failure"
    | "provider_outage";

export interface Anomaly {
    type: AnomalyType;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    metadata: Record<string, any>;
    detectedAt: string;
}

// ─── Detection Engine ───

/**
 * Run all anomaly detection rules for a user.
 * Returns array of detected anomalies (may be empty).
 * Idempotent — safe to call repeatedly without side effects.
 */
export async function detectAnomalies(scope: AiScope): Promise<Anomaly[]> {
    const [trailing, today] = await Promise.all([
        getTrailingAverages(scope, 7),
        getTodayStats(scope),
    ]);

    const anomalies: Anomaly[] = [];
    const now = new Date().toISOString();

    // ── Rule 1: Cost Spike ──
    if (trailing.avgDailyCost > 0 && today.cost > trailing.avgDailyCost * COST_SPIKE_MULTIPLIER) {
        const pct = Math.round((today.cost / trailing.avgDailyCost) * 100);
        anomalies.push({
            type: "cost_spike",
            severity: pct > 300 ? "critical" : pct > 200 ? "high" : "medium",
            title: "Cost spike detected",
            message: `Today's AI spend ($${today.cost.toFixed(2)}) is ${pct}% of the 7-day average ($${trailing.avgDailyCost.toFixed(2)}).`,
            metadata: { todayCost: today.cost, trailingAvg: trailing.avgDailyCost, percentOfAvg: pct },
            detectedAt: now,
        });
    }

    // ── Rule 2: Token Spike ──
    if (trailing.avgDailyTokens > 0 && today.tokens > trailing.avgDailyTokens * TOKEN_SPIKE_MULTIPLIER) {
        const pct = Math.round((today.tokens / trailing.avgDailyTokens) * 100);
        anomalies.push({
            type: "token_spike",
            severity: pct > 300 ? "high" : "medium",
            title: "Token usage spike",
            message: `Today's tokens (${today.tokens.toLocaleString()}) are ${pct}% of the 7-day average (${Math.round(trailing.avgDailyTokens).toLocaleString()}).`,
            metadata: { todayTokens: today.tokens, trailingAvg: trailing.avgDailyTokens, percentOfAvg: pct },
            detectedAt: now,
        });
    }

    // ── Rule 3: Error Spike ──
    const hasAbsoluteSpike = today.requests > 0 && today.errorRate > ERROR_RATE_THRESHOLD;
    const hasRelativeSpike = trailing.avgDailyErrorRate > 0 && today.errorRate > trailing.avgDailyErrorRate * ERROR_RATE_SPIKE_MULTIPLIER;

    if (hasAbsoluteSpike || hasRelativeSpike) {
        const ratePct = Math.round(today.errorRate * 100);
        anomalies.push({
            type: "error_spike",
            severity: ratePct > 30 ? "critical" : ratePct > 20 ? "high" : "medium",
            title: "High AI error rate",
            message: `${ratePct}% of today's ${today.requests} requests have failed (${today.errors} errors).`,
            metadata: { errorRate: today.errorRate, errors: today.errors, requests: today.requests },
            detectedAt: now,
        });
    }

    // ── Rule 4: Latency Spike ──
    if (trailing.avgDailyLatency > 0 && today.avgLatency > trailing.avgDailyLatency * LATENCY_SPIKE_MULTIPLIER) {
        const factor = (today.avgLatency / trailing.avgDailyLatency).toFixed(1);
        anomalies.push({
            type: "latency_spike",
            severity: today.avgLatency > trailing.avgDailyLatency * 3 ? "high" : "medium",
            title: "AI latency spike",
            message: `Average latency today (${Math.round(today.avgLatency)}ms) is ${factor}× the trailing average (${Math.round(trailing.avgDailyLatency)}ms).`,
            metadata: { todayLatency: today.avgLatency, trailingAvg: trailing.avgDailyLatency },
            detectedAt: now,
        });
    }

    // ── Rule 5: Silent Failure ──
    // Requests drop to near-zero when normally active
    if (trailing.avgDailyRequests >= SILENT_FAILURE_MIN_TRAILING && today.requests < trailing.avgDailyRequests * SILENT_FAILURE_THRESHOLD) {
        anomalies.push({
            type: "silent_failure",
            severity: "high",
            title: "AI requests near zero",
            message: `Only ${today.requests} requests today vs ${Math.round(trailing.avgDailyRequests)} daily average. Possible integration failure.`,
            metadata: { todayRequests: today.requests, trailingAvg: trailing.avgDailyRequests },
            detectedAt: now,
        });
    }

    // ── Rule 6: Provider Outage Suspicion ──
    // High failure rate concentrated on one provider today
    const providerErrors = await getProviderErrorConcentration(scope);
    for (const p of providerErrors) {
        if (p.errors >= PROVIDER_OUTAGE_MIN_ERRORS && p.errorRate >= PROVIDER_OUTAGE_ERROR_RATE) {
            anomalies.push({
                type: "provider_outage",
                severity: p.errorRate > 0.8 ? "critical" : "high",
                title: `${p.provider} outage suspected`,
                message: `${p.provider} has ${Math.round(p.errorRate * 100)}% error rate today (${p.errors}/${p.total} requests).`,
                metadata: { provider: p.provider, errors: p.errors, total: p.total, errorRate: p.errorRate },
                detectedAt: now,
            });
        }
    }

    return anomalies;
}

// ─── Provider Error Concentration ───

interface ProviderErrorInfo {
    provider: string;
    total: number;
    errors: number;
    errorRate: number;
}

async function getProviderErrorConcentration(scope: AiScope): Promise<ProviderErrorInfo[]> {
    const today = todayString();
    const startOfDay = new Date(today);

    const agg = await AiRequestLog.aggregate([
        { $match: { ...buildScopeMatch(scope), createdAt: { $gte: startOfDay } } },
        {
            $group: {
                _id: "$provider",
                total: { $sum: 1 },
                errors: { $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] } },
            },
        },
    ]);

    return agg.map((row: any) => ({
        provider: row._id,
        total: row.total,
        errors: row.errors,
        errorRate: row.total > 0 ? row.errors / row.total : 0,
    }));
}
