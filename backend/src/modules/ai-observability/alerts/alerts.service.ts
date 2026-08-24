import { AiAlert, AiAlertSeverity, AiAlertType } from "../../../models/ai-alert.model";
import { AiRequestLog } from "../../../models/ai-request-log.model";
import { getBudgetStatus } from "../services/budget/budget.service";
import { getTodayStats, getTrailingAverages } from "../services/overview.service";
import { AiScope } from "../services/scope.service";

const SPIKE_THRESHOLD = 1.5;
const ERROR_RATE_THRESHOLD = 0.1;
const LATENCY_SPIKE_MULTIPLIER = 2;
const DEDUP_WINDOW_HOURS = 12;

export interface AlertFilter {
    status?: "open" | "acknowledged" | "resolved";
}

export async function getAlerts(userId: string, filter?: AlertFilter) {
    const query: Record<string, any> = { userId };
    if (filter?.status && ["open", "acknowledged", "resolved"].includes(filter.status)) {
        query.status = filter.status;
    }

    return AiAlert.find(query, { __v: 0 })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
}

export async function acknowledgeAlert(userId: string, alertId: string) {
    return AiAlert.findOneAndUpdate(
        { _id: alertId, userId },
        { $set: { status: "acknowledged" } },
        { returnDocument: "after", projection: { __v: 0 } },
    ).lean();
}

export async function resolveAlert(userId: string, alertId: string) {
    return AiAlert.findOneAndUpdate(
        { _id: alertId, userId },
        { $set: { status: "resolved", resolvedAt: new Date() } },
        { returnDocument: "after", projection: { __v: 0 } },
    ).lean();
}

async function isDuplicate(userId: string, type: AiAlertType): Promise<boolean> {
    const cutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);
    const existing = await AiAlert.findOne({
        userId,
        type,
        status: { $in: ["open", "acknowledged"] },
        createdAt: { $gte: cutoff },
    }).lean();
    return !!existing;
}

export async function createAlert(
    userId: string,
    type: AiAlertType,
    severity: AiAlertSeverity,
    title: string,
    message: string,
    metadata?: Record<string, any>,
) {
    if (await isDuplicate(userId, type)) return null;

    return AiAlert.create({
        userId,
        type,
        severity,
        title,
        message,
        status: "open",
        metadata: metadata || {},
    });
}

export async function evaluateAlertRules(scope: AiScope) {
    const [trailing, today] = await Promise.all([
        getTrailingAverages(scope, 7),
        getTodayStats(scope),
    ]);
    const userId = scope.userId;
    const created: any[] = [];

    if (trailing.avgDailyCost > 0 && today.cost > trailing.avgDailyCost * SPIKE_THRESHOLD) {
        const pct = Math.round((today.cost / trailing.avgDailyCost) * 100);
        const alert = await createAlert(
            userId,
            "cost_spike",
            pct > 300 ? "critical" : pct > 200 ? "high" : "medium",
            "Unusual cost spike detected",
            `Today's AI spend ($${today.cost.toFixed(2)}) is ${pct}% of your trailing 7-day daily average ($${trailing.avgDailyCost.toFixed(2)}).`,
            { todayCost: today.cost, trailingAvg: trailing.avgDailyCost, percentOfAvg: pct },
        );
        if (alert) created.push(alert);
    }

    if (trailing.avgDailyTokens > 0 && today.tokens > trailing.avgDailyTokens * SPIKE_THRESHOLD) {
        const pct = Math.round((today.tokens / trailing.avgDailyTokens) * 100);
        const alert = await createAlert(
            userId,
            "token_spike",
            pct > 300 ? "high" : "medium",
            "Token usage spike detected",
            `Today's token usage (${today.tokens.toLocaleString()}) is ${pct}% of your trailing 7-day daily average (${Math.round(trailing.avgDailyTokens).toLocaleString()}).`,
            { todayTokens: today.tokens, trailingAvg: trailing.avgDailyTokens, percentOfAvg: pct },
        );
        if (alert) created.push(alert);
    }

    if (today.requests > 0 && today.errorRate > ERROR_RATE_THRESHOLD) {
        const ratePct = Math.round(today.errorRate * 100);
        const alert = await createAlert(
            userId,
            "error_spike",
            ratePct > 30 ? "critical" : ratePct > 20 ? "high" : "medium",
            "High AI error rate detected",
            `${ratePct}% of today's ${today.requests} AI requests have failed (${today.errors} errors).`,
            { errorRate: today.errorRate, errors: today.errors, requests: today.requests },
        );
        if (alert) created.push(alert);
    }

    if (trailing.avgDailyLatency > 0 && today.avgLatency > trailing.avgDailyLatency * LATENCY_SPIKE_MULTIPLIER) {
        const factor = (today.avgLatency / trailing.avgDailyLatency).toFixed(1);
        const alert = await createAlert(
            userId,
            "latency_spike",
            today.avgLatency > trailing.avgDailyLatency * 3 ? "high" : "medium",
            "AI response latency spike",
            `Average latency today (${Math.round(today.avgLatency)}ms) is ${factor}x your trailing average (${Math.round(trailing.avgDailyLatency)}ms).`,
            { todayLatency: today.avgLatency, trailingAvg: trailing.avgDailyLatency },
        );
        if (alert) created.push(alert);
    }

    try {
        const budgetStatus = await getBudgetStatus(userId);
        if (budgetStatus && budgetStatus.rule.enabled && budgetStatus.monthlyUsagePercent >= budgetStatus.rule.alertThresholdPercent) {
            const alert = await createAlert(
                userId,
                "budget_limit",
                budgetStatus.monthlyUsagePercent >= 100 ? "critical" : "high",
                budgetStatus.monthlyUsagePercent >= 100 ? "Monthly AI budget exceeded" : "Approaching monthly AI budget limit",
                `You've used ${budgetStatus.monthlyUsagePercent.toFixed(1)}% of your $${budgetStatus.rule.monthlyLimit} monthly budget ($${budgetStatus.currentMonthSpend.toFixed(2)} spent).`,
                {
                    monthlyLimit: budgetStatus.rule.monthlyLimit,
                    currentSpend: budgetStatus.currentMonthSpend,
                    usagePercent: budgetStatus.monthlyUsagePercent,
                },
            );
            if (alert) created.push(alert);
        }
    } catch {
        // Budget rules are optional.
    }

    try {
        const hourAgo = new Date(Date.now() - 3600000);
        const errorCostAgg = await AiRequestLog.aggregate([
            { $match: { userId, status: { $ne: "success" }, createdAt: { $gte: hourAgo } } },
            { $group: { _id: null, cost: { $sum: "$cost" }, count: { $sum: 1 } } },
        ]);
        const errorCost = errorCostAgg[0]?.cost || 0;
        if (errorCost > 10) {
            const alert = await createAlert(
                userId,
                "error_cost",
                errorCost > 50 ? "high" : "medium",
                "Money wasted on failed AI requests",
                `You're paying $${errorCost.toFixed(2)}/hour for failed requests (${errorCostAgg[0]?.count || 0} failures in the last hour).`,
                { errorCostPerHour: errorCost, errorCount: errorCostAgg[0]?.count || 0 },
            );
            if (alert) created.push(alert);
        }
    } catch {
        // Error-cost aggregation is best effort.
    }

    return created.filter(Boolean);
}
