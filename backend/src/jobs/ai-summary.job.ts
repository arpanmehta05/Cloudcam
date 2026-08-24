import { logger } from "../core/logger";
// ─── AI Observability: Weekly Summary Job ───
// Runs weekly on Monday at 01:00 UTC via cron.
// Generates optimization insights and provider comparison reports.

import { AiDailyMetric } from "../models/ai-daily-metric.model";
import { generateWeeklySummary } from "../services/ai-insights.service";
import { notify } from "../services/ai-notification.service";

/**
 * Get all users with AI activity in the last 7 days.
 */
async function getRecentUsers(): Promise<string[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffDate = sevenDaysAgo.toISOString().slice(0, 10);

  return AiDailyMetric.distinct("userId", {
    date: { $gte: cutoffDate },
  });
}

/**
 * Main weekly summary job.
 */
export async function runSummaryJob(): Promise<void> {
  const userIds = await getRecentUsers();

  if (userIds.length === 0) {
    logger.info("[AI-Weekly] No active users, skipping");
    return;
  }

  logger.info(
    `[AI-Weekly] Generating weekly insights for ${userIds.length} users`,
  );

  let insightsCount = 0;

  for (const userId of userIds) {
    try {
      const summary = await generateWeeklySummary(userId);
      insightsCount += summary.insights.length;

      // Build narrative from insights
      const narrativeParts = [
        `Weekly AI Summary (${summary.weekStart} → ${summary.weekEnd}):`,
        `- ${summary.totalRequests.toLocaleString()} requests | $${summary.totalCost.toFixed(2)} spend | ${summary.totalTokens.toLocaleString()} tokens`,
      ];

      if (summary.insights.length > 0) {
        narrativeParts.push(
          `- ${summary.insights.length} insight${summary.insights.length > 1 ? "s" : ""}:`,
        );
        for (const insight of summary.insights.slice(0, 5)) {
          narrativeParts.push(
            `  • [${insight.priority.toUpperCase()}] ${insight.title}`,
          );
        }
      } else {
        narrativeParts.push("- No optimization recommendations this week");
      }

      const hasHighPriority = summary.insights.some(
        (i) => i.priority === "high",
      );

      await notify({
        userId,
        title: "AI Weekly Insights",
        message: narrativeParts.join("\n"),
        severity: hasHighPriority ? "medium" : "low",
        type: "weekly_summary",
        metadata: {
          weekStart: summary.weekStart,
          weekEnd: summary.weekEnd,
          totalRequests: summary.totalRequests,
          totalCost: summary.totalCost,
          insightsCount: summary.insights.length,
        },
      });
    } catch (err) {
      logger.error(`[AI-Weekly] Error processing user ${userId}:`, err);
    }
  }

  logger.info(
    `[AI-Weekly] Complete: ${insightsCount} total insights generated`,
  );
}
