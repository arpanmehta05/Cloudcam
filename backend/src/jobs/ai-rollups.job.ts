import { logger } from "../core/logger";
// ─── AI Observability: Daily Rollup Job ───
// Runs daily at 00:10 UTC via cron.
// 1. Rolls up raw AiRequestLog entries into AiDailyMetric (for yesterday)
// 2. Generates daily executive summary
// 3. Evaluates budget progress
//
// Idempotent — uses upsert with $inc for metric rollups.

import { AiRequestLog } from "../models/ai-request-log.model";
import { AiDailyMetric } from "../models/ai-daily-metric.model";
import { generateDailySummary } from "../services/ai-insights.service";
import { enforceBudget } from "../services/ai-budget-enforcement.service";
import { notify } from "../services/ai-notification.service";

// ─── Helpers ───

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Get all distinct user IDs with request logs from yesterday.
 */
async function getUsersWithActivity(dateStr: string): Promise<string[]> {
  const start = new Date(dateStr);
  const end = new Date(start.getTime() + 86400000);

  return AiRequestLog.distinct("userId", {
    createdAt: { $gte: start, $lt: end },
  });
}

// ─── Rollup Logic ───

/**
 * Roll up request logs for a user + date into AiDailyMetric.
 * Uses aggregation pipeline then upserts per provider.
 */
async function rollupUserDay(userId: string, dateStr: string): Promise<number> {
  const start = new Date(dateStr);
  const end = new Date(start.getTime() + 86400000);

  // Aggregate by provider and observability scope.
  const providerAgg = await AiRequestLog.aggregate([
    { $match: { userId, createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: {
          provider: "$provider",
          tenantId: { $ifNull: ["$tenantId", null] },
          workspaceId: { $ifNull: ["$workspaceId", null] },
          environment: { $ifNull: ["$environment", "prod"] },
        },
        requests: { $sum: 1 },
        promptTokens: { $sum: "$promptTokens" },
        completionTokens: { $sum: "$completionTokens" },
        totalTokens: { $sum: "$totalTokens" },
        totalCost: { $sum: "$cost" },
        errorCount: {
          $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] },
        },
        _latencySum: { $sum: "$latencyMs" },
      },
    },
  ]);

  // Upsert each provider row into AiDailyMetric
  for (const row of providerAgg) {
    const avgLatencyMs =
      row.requests > 0 ? Math.round(row._latencySum / row.requests) : 0;

    await AiDailyMetric.updateOne(
      {
        userId,
        tenantId: row._id.tenantId,
        workspaceId: row._id.workspaceId,
        environment: row._id.environment,
        date: dateStr,
        provider: row._id.provider,
      },
      {
        $set: {
          requests: row.requests,
          promptTokens: row.promptTokens,
          completionTokens: row.completionTokens,
          totalTokens: row.totalTokens,
          totalCost: Math.round(row.totalCost * 10000) / 10000,
          errorCount: row.errorCount,
          avgLatencyMs,
        },
        $setOnInsert: {
          tenantId: row._id.tenantId,
          workspaceId: row._id.workspaceId,
          environment: row._id.environment,
        },
      },
      { upsert: true },
    );
  }

  return providerAgg.length;
}

// ─── Main Job ───

export async function runRollupsJob(): Promise<void> {
  const yesterday = yesterdayString();
  const userIds = await getUsersWithActivity(yesterday);

  if (userIds.length === 0) {
    logger.info("[AI-Rollups] No activity yesterday, skipping");
    return;
  }

  logger.info(
    `[AI-Rollups] Rolling up ${userIds.length} users for ${yesterday}`,
  );

  let totalProviderRows = 0;
  let summariesGenerated = 0;
  let budgetChecks = 0;

  for (const userId of userIds) {
    try {
      // 1. Roll up metrics
      const rows = await rollupUserDay(userId, yesterday);
      totalProviderRows += rows;

      // 2. Generate daily summary
      const summary = await generateDailySummary(userId, yesterday);
      summariesGenerated++;

      // 3. Send daily summary notification (if channels configured)
      await notify({
        userId,
        title: "AI Daily Summary",
        message: summary.narrative,
        severity: "low",
        type: "daily_summary",
        metadata: {
          date: summary.date,
          requests: summary.requests,
          cost: summary.totalCost,
          errorRate: `${(summary.errorRate * 100).toFixed(1)}%`,
        },
      });

      // 4. Evaluate budget
      const enforcement = await enforceBudget(userId);
      if (enforcement) budgetChecks++;
    } catch (err) {
      logger.error(`[AI-Rollups] Error processing user ${userId}:`, err);
    }
  }

  logger.info(
    `[AI-Rollups] Complete: ${totalProviderRows} provider rows, ${summariesGenerated} summaries, ${budgetChecks} budget checks`,
  );
}
