// ─── AI Observability: Budget Enforcement Service ───
// Evaluates spend vs thresholds and takes action (alerts, soft-block).
// Called by cron jobs and optionally via manual trigger API.

import { AiBudgetRule } from "../../../../models/ai-budget-rule.model";
import { getBudgetStatus, type BudgetStatus } from "./budget.service";
import { createAlert } from "../../alerts/alerts.service";

// ─── Enforcement Result ───

export interface EnforcementResult {
    userId: string;
    status: "ok" | "warning" | "exceeded" | "paused";
    monthlyUsagePercent: number;
    currentMonthSpend: number;
    monthlyLimit: number;
    alertsCreated: number;
    softBlocked: boolean;
}

// ─── Enforcement Logic ───

/**
 * Evaluate budget rules for a user and take action:
 * 1. 80% threshold → warning alert
 * 2. 100% threshold → critical alert
 * 3. autoPause + exceeded → set softBlocked flag on budget rule
 *
 * Idempotent — dedup is handled by createAlert.
 */
export async function enforceBudget(userId: string): Promise<EnforcementResult | null> {
    const budgetStatus = await getBudgetStatus(userId);
    if (!budgetStatus || !budgetStatus.rule.enabled) {
        return null; // No budget rule or disabled
    }

    const result: EnforcementResult = {
        userId,
        status: "ok",
        monthlyUsagePercent: budgetStatus.monthlyUsagePercent,
        currentMonthSpend: budgetStatus.currentMonthSpend,
        monthlyLimit: budgetStatus.rule.monthlyLimit,
        alertsCreated: 0,
        softBlocked: false,
    };

    // ── Warning at threshold (default 80%) ──
    if (budgetStatus.monthlyUsagePercent >= budgetStatus.rule.alertThresholdPercent
        && budgetStatus.monthlyUsagePercent < 100) {
        result.status = "warning";
        const alert = await createAlert(
            userId,
            "budget_limit",
            "high",
            "Approaching AI budget limit",
            `You've used ${budgetStatus.monthlyUsagePercent.toFixed(1)}% of your $${budgetStatus.rule.monthlyLimit} monthly budget ($${budgetStatus.currentMonthSpend.toFixed(2)} spent).`,
            {
                monthlyLimit: budgetStatus.rule.monthlyLimit,
                currentSpend: budgetStatus.currentMonthSpend,
                usagePercent: budgetStatus.monthlyUsagePercent,
                level: "warning",
            }
        );
        if (alert) result.alertsCreated++;
    }

    // ── Critical at 100% ──
    if (budgetStatus.monthlyUsagePercent >= 100) {
        result.status = "exceeded";
        const alert = await createAlert(
            userId,
            "budget_limit",
            "critical",
            "Monthly AI budget exceeded",
            `You've exceeded your $${budgetStatus.rule.monthlyLimit} monthly budget. Current spend: $${budgetStatus.currentMonthSpend.toFixed(2)} (${budgetStatus.monthlyUsagePercent.toFixed(1)}%).`,
            {
                monthlyLimit: budgetStatus.rule.monthlyLimit,
                currentSpend: budgetStatus.currentMonthSpend,
                usagePercent: budgetStatus.monthlyUsagePercent,
                level: "critical",
            }
        );
        if (alert) result.alertsCreated++;
    }

    // ── Auto-Pause: Soft-block via flag on budget rule ──
    if (budgetStatus.shouldPause) {
        result.status = "paused";
        result.softBlocked = true;

        // Set a softBlocked flag on the budget rule document.
        // Ingestion service should check this flag before processing requests.
        await AiBudgetRule.updateOne(
            { userId },
            { $set: { softBlocked: true, softBlockedAt: new Date() } }
        );
    } else {
        // Clear soft-block if no longer needed
        await AiBudgetRule.updateOne(
            { userId, softBlocked: true },
            { $set: { softBlocked: false }, $unset: { softBlockedAt: "" } }
        );
    }

    // ── Daily limit check ──
    if (budgetStatus.isDailyExceeded) {
        const alert = await createAlert(
            userId,
            "budget_limit",
            "high",
            "Daily AI spend limit reached",
            `Today's AI spend ($${budgetStatus.currentDaySpend.toFixed(2)}) has reached the daily limit of $${budgetStatus.rule.dailyLimit}.`,
            {
                dailyLimit: budgetStatus.rule.dailyLimit,
                currentDaySpend: budgetStatus.currentDaySpend,
                level: "daily_exceeded",
            }
        );
        if (alert) result.alertsCreated++;
    }

    return result;
}
