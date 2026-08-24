// ─── AI Observability: Forecast Service ───
// Provides month-end cost/token projections and budget burn-rate calculations.
// Uses AiDailyMetric for efficient aggregation — no full scans on AiRequestLog.

import { AiDailyMetric } from "../../../models/ai-daily-metric.model";
import { getBudgetStatus } from "./budget/budget.service";

// ─── Helpers ───

function todayString(): string {
    return new Date().toISOString().slice(0, 10);
}

function monthStartString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function daysInCurrentMonth(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function elapsedDaysInMonth(): number {
    return new Date().getDate();
}

// ─── Result Interfaces ───

export interface ForecastResult {
    // Cost forecast
    monthToDateSpend: number;
    projectedMonthEndSpend: number;
    avgDailySpend: number;
    remainingBudgetDays: number | null; // null if no budget rule exists

    // Token forecast
    monthToDateTokens: number;
    projectedMonthEndTokens: number;
    avgDailyTokens: number;

    // Request forecast
    monthToDateRequests: number;
    projectedMonthEndRequests: number;
    avgDailyRequests: number;

    // Budget status
    budgetLimit: number | null;
    budgetUsagePercent: number | null;
    daysUntilBudgetExceeded: number | null; // null if never or no budget

    // Metadata
    elapsedDays: number;
    totalDays: number;
    generatedAt: string;
}

// ─── Main Forecast Function ───

export async function generateForecast(userId: string): Promise<ForecastResult> {
    const monthStart = monthStartString();
    const elapsed = elapsedDaysInMonth();
    const totalDays = daysInCurrentMonth();

    // Aggregate month-to-date totals from AiDailyMetric
    const monthAgg = await AiDailyMetric.aggregate([
        { $match: { userId, date: { $gte: monthStart } } },
        {
            $group: {
                _id: null,
                totalCost: { $sum: "$totalCost" },
                totalTokens: { $sum: "$totalTokens" },
                totalRequests: { $sum: "$requests" },
            },
        },
    ]);

    const row = monthAgg[0] || { totalCost: 0, totalTokens: 0, totalRequests: 0 };

    const avgDailySpend = elapsed > 0 ? row.totalCost / elapsed : 0;
    const avgDailyTokens = elapsed > 0 ? row.totalTokens / elapsed : 0;
    const avgDailyRequests = elapsed > 0 ? row.totalRequests / elapsed : 0;

    const projectedMonthEndSpend = Math.round(avgDailySpend * totalDays * 100) / 100;
    const projectedMonthEndTokens = Math.round(avgDailyTokens * totalDays);
    const projectedMonthEndRequests = Math.round(avgDailyRequests * totalDays);

    // Budget analysis
    let budgetLimit: number | null = null;
    let budgetUsagePercent: number | null = null;
    let daysUntilBudgetExceeded: number | null = null;
    let remainingBudgetDays: number | null = null;

    try {
        const budgetStatus = await getBudgetStatus(userId);
        if (budgetStatus && budgetStatus.rule.enabled) {
            budgetLimit = budgetStatus.rule.monthlyLimit;
            budgetUsagePercent = budgetStatus.monthlyUsagePercent;

            if (avgDailySpend > 0 && budgetLimit > 0) {
                const remainingBudget = budgetLimit - row.totalCost;
                if (remainingBudget <= 0) {
                    daysUntilBudgetExceeded = 0;
                    remainingBudgetDays = 0;
                } else {
                    daysUntilBudgetExceeded = Math.floor(remainingBudget / avgDailySpend);
                    remainingBudgetDays = daysUntilBudgetExceeded;
                }
            }
        }
    } catch {
        // Budget rule not found — fine, skip
    }

    return {
        monthToDateSpend: Math.round(row.totalCost * 100) / 100,
        projectedMonthEndSpend,
        avgDailySpend: Math.round(avgDailySpend * 100) / 100,
        remainingBudgetDays,

        monthToDateTokens: row.totalTokens,
        projectedMonthEndTokens,
        avgDailyTokens: Math.round(avgDailyTokens),

        monthToDateRequests: row.totalRequests,
        projectedMonthEndRequests,
        avgDailyRequests: Math.round(avgDailyRequests),

        budgetLimit,
        budgetUsagePercent: budgetUsagePercent !== null ? Math.round(budgetUsagePercent * 10) / 10 : null,
        daysUntilBudgetExceeded,

        elapsedDays: elapsed,
        totalDays: totalDays,
        generatedAt: new Date().toISOString(),
    };
}
