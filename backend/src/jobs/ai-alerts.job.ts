import { logger } from "../core/logger";
// ─── AI Observability: Alerts Job ───
// Runs every 15 minutes via cron.
// Evaluates spike/anomaly rules and budget enforcement for ALL active users.
// Idempotent — relies on alert deduplication in ai-alerts.service.ts.

import { AiDailyMetric } from "../models/ai-daily-metric.model";
import { evaluateAlertRules } from "../services/ai-alerts.service";
import { detectAnomalies } from "../services/ai-anomaly.service";
import { enforceBudget } from "../services/ai-budget-enforcement.service";
import { createAlert } from "../services/ai-alerts.service";
import { notifyIfCritical } from "../services/ai-notification.service";

/**
 * Get all distinct user IDs that have AI metrics data.
 * Uses AiDailyMetric's userId index — fast even at scale.
 */
async function getActiveUserIds(): Promise<string[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const users = await AiDailyMetric.distinct("userId", {
    date: { $gte: cutoffDate },
  });

  return users;
}

/**
 * Main alerts job — called by cron every 15 minutes.
 */
export async function runAlertsJob(): Promise<void> {
  const userIds = await getActiveUserIds();
  if (userIds.length === 0) {
    logger.info("[AI-Alerts-Job] No active users, skipping");
    return;
  }

  logger.info(`[AI-Alerts-Job] Evaluating ${userIds.length} users`);

  let totalAlerts = 0;
  let totalAnomalies = 0;
  let totalBudgetActions = 0;

  for (const userId of userIds) {
    try {
      const scope = { userId };
      // 1. Evaluate standard alert rules (cost/token/error/latency spikes + budget)
      const alerts = await evaluateAlertRules(scope);
      totalAlerts += alerts.length;

      // 2. Run anomaly detection
      const anomalies = await detectAnomalies(scope);
      totalAnomalies += anomalies.length;

      // Create alerts for new anomaly types not covered by evaluateAlertRules
      for (const anomaly of anomalies) {
        if (
          anomaly.type === "silent_failure" ||
          anomaly.type === "provider_outage"
        ) {
          // These are extra anomaly types not in the standard rules engine
          const alertType =
            anomaly.type === "silent_failure" ? "error_spike" : "error_spike";
          const alert = await createAlert(
            userId,
            alertType,
            anomaly.severity as any,
            anomaly.title,
            anomaly.message,
            anomaly.metadata,
          );
          if (alert) totalAlerts++;
        }
      }

      // 3. Enforce budget rules
      const enforcement = await enforceBudget(userId);
      if (enforcement && enforcement.alertsCreated > 0) {
        totalBudgetActions += enforcement.alertsCreated;
      }

      // 4. Send external notifications for critical/high alerts
      for (const alert of alerts) {
        await notifyIfCritical({
          userId,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          type: alert.type,
          metadata: alert.metadata,
        });
      }
    } catch (err) {
      logger.error(`[AI-Alerts-Job] Error processing user ${userId}:`, err);
      // Continue processing other users — don't let one failure stop the batch
    }
  }

  logger.info(
    `[AI-Alerts-Job] Complete: ${totalAlerts} alerts, ${totalAnomalies} anomalies, ${totalBudgetActions} budget actions`,
  );
}
