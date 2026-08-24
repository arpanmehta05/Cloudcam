// ─── AI Observability: Budget Service ───
// Manages per-user AI spending budget rules and evaluates current spend vs thresholds.

import { AiBudgetRule, IAiBudgetRule } from "../../../../models/ai-budget-rule.model";
import { AiDailyMetric } from "../../../../models/ai-daily-metric.model";

// ─── Interfaces ───

export interface CreateBudgetInput {
    monthlyLimit: number;
    dailyLimit?: number;
    alertThresholdPercent?: number;
    autoPause?: boolean;
    enabled?: boolean;
}

export interface UpdateBudgetInput {
    monthlyLimit?: number;
    dailyLimit?: number | null;
    alertThresholdPercent?: number;
    autoPause?: boolean;
    enabled?: boolean;
}

export interface BudgetStatus {
    rule: {
        _id: string;
        monthlyLimit: number;
        dailyLimit: number | null;
        alertThresholdPercent: number;
        autoPause: boolean;
        enabled: boolean;
    };
    currentMonthSpend: number;
    currentDaySpend: number;
    monthlyUsagePercent: number;
    dailyUsagePercent: number | null; // null if no daily limit set
    isMonthlyExceeded: boolean;
    isDailyExceeded: boolean;
    shouldPause: boolean; // true if autoPause=true AND any limit exceeded
}

// ─── Helpers ───

function monthStartString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayString(): string {
    return new Date().toISOString().slice(0, 10);
}

// ─── Budget CRUD ───

/**
 * Get the user's budget rule (one per user).
 */
export async function getBudgetRule(userId: string) {
    return AiBudgetRule.findOne({ userId }, { __v: 0 }).lean();
}

/**
 * Create a new budget rule.
 * Returns the created rule, or throws if one already exists.
 */
export async function createBudgetRule(userId: string, input: CreateBudgetInput) {
    const existing = await AiBudgetRule.findOne({ userId });
    if (existing) {
        throw new Error("Budget rule already exists. Use update instead.");
    }

    const rule = await AiBudgetRule.create({
        userId,
        monthlyLimit: input.monthlyLimit,
        dailyLimit: typeof input.dailyLimit === "number" && input.dailyLimit > 0
            ? input.dailyLimit
            : undefined,
        alertThresholdPercent: typeof input.alertThresholdPercent === "number"
            ? input.alertThresholdPercent
            : 80,
        autoPause: input.autoPause === true,
        enabled: input.enabled !== false,
    });

    return rule;
}

/**
 * Update an existing budget rule by ID.
 * Only updates fields that are provided.
 */
export async function updateBudgetRule(userId: string, ruleId: string, input: UpdateBudgetInput) {
    const update: Record<string, any> = {};
    if (typeof input.monthlyLimit === "number" && input.monthlyLimit > 0) {
        update.monthlyLimit = input.monthlyLimit;
    }
    if (typeof input.dailyLimit === "number") {
        update.dailyLimit = input.dailyLimit > 0 ? input.dailyLimit : null;
    } else if (input.dailyLimit === null) {
        update.dailyLimit = null;
    }
    if (typeof input.alertThresholdPercent === "number") {
        update.alertThresholdPercent = input.alertThresholdPercent;
    }
    if (typeof input.autoPause === "boolean") {
        update.autoPause = input.autoPause;
    }
    if (typeof input.enabled === "boolean") {
        update.enabled = input.enabled;
    }

    if (Object.keys(update).length === 0) {
        return null; // Nothing to update
    }

    return AiBudgetRule.findOneAndUpdate(
        { _id: ruleId, userId },
        { $set: update },
        { returnDocument: "after", projection: { __v: 0 } }
    ).lean();
}

// ─── Budget Evaluation ───

/**
 * Compute the current budget status: how much has been spent vs limits.
 * Returns null if no budget rule exists for this user.
 */
export async function getBudgetStatus(userId: string): Promise<BudgetStatus | null> {
    const rule = await AiBudgetRule.findOne({ userId }).lean();
    if (!rule) return null;

    const today = todayString();
    const monthStart = monthStartString();

    // Month-to-date spend (sum across all providers)
    const monthAgg = await AiDailyMetric.aggregate([
        { $match: { userId, date: { $gte: monthStart } } },
        { $group: { _id: null, cost: { $sum: "$totalCost" } } },
    ]);
    const currentMonthSpend = monthAgg[0]?.cost || 0;

    // Today's spend
    const dayAgg = await AiDailyMetric.aggregate([
        { $match: { userId, date: today } },
        { $group: { _id: null, cost: { $sum: "$totalCost" } } },
    ]);
    const currentDaySpend = dayAgg[0]?.cost || 0;

    const monthlyUsagePercent = rule.monthlyLimit > 0
        ? (currentMonthSpend / rule.monthlyLimit) * 100
        : 0;

    const dailyUsagePercent = rule.dailyLimit && rule.dailyLimit > 0
        ? (currentDaySpend / rule.dailyLimit) * 100
        : null;

    const isMonthlyExceeded = currentMonthSpend >= rule.monthlyLimit;
    const isDailyExceeded = !!(rule.dailyLimit && rule.dailyLimit > 0 && currentDaySpend >= rule.dailyLimit);
    const shouldPause = rule.autoPause && rule.enabled && (isMonthlyExceeded || isDailyExceeded);

    return {
        rule: {
            _id: String(rule._id),
            monthlyLimit: rule.monthlyLimit,
            dailyLimit: rule.dailyLimit ?? null,
            alertThresholdPercent: rule.alertThresholdPercent,
            autoPause: rule.autoPause,
            enabled: rule.enabled,
        },
        currentMonthSpend,
        currentDaySpend,
        monthlyUsagePercent,
        dailyUsagePercent,
        isMonthlyExceeded,
        isDailyExceeded,
        shouldPause,
    };
}
