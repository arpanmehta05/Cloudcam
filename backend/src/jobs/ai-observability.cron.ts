import { logger } from "../core/logger";
// ─── AI Observability: Cron Job Scheduler ───
// Central scheduler for all AI Observability background jobs.
// Uses node-cron for scheduling, with idempotent job wrappers.
// Each job logs start/end/duration/errors for observability.
//
// Environment variables:
//   AI_CRON_ENABLED=true     — enables the scheduler (default: true)
//   AI_CRON_LOG_LEVEL=info   — job logging verbosity

import cron from "node-cron";
import { runAlertsJob } from "./ai-alerts.job";
import { runRollupsJob } from "./ai-rollups.job";
import { runSummaryJob } from "./ai-summary.job";
import { runAwsAiCollectorJob } from "./aws-ai-collector.job";
import { runUsageReportJob } from "./usage-report.job";
import { runVpsLogArchiveJob } from "./vps-log-archive.job";


// ─── Job Runner Wrapper ───

type JobFn = () => Promise<void>;

/**
 * Wraps a job function with timing, error handling, and logging.
 * Prevents overlapping runs of the same job.
 */
function createJob(name: string, fn: JobFn) {
  let running = false;

  return async () => {
    if (running) {
      logger.info(`[AI-Cron] ⏭ ${name}: already running, skipping`);
      return;
    }
    running = true;
    const start = Date.now();
    logger.info(`[AI-Cron] ▶ ${name}: started`);

    try {
      await fn();
      const duration = Date.now() - start;
      logger.info(`[AI-Cron] ✅ ${name}: completed in ${duration}ms`);
    } catch (err) {
      const duration = Date.now() - start;
      logger.error(`[AI-Cron] ❌ ${name}: failed after ${duration}ms`, err);
    } finally {
      running = false;
    }
  };
}

// ─── Schedule Definitions ───

export function startAiObservabilityCron() {
  const enabled = process.env.AI_CRON_ENABLED !== "false";
  if (!enabled) {
    logger.info(
      "[AI-Cron] AI Observability cron jobs DISABLED (AI_CRON_ENABLED=false)",
    );
    return;
  }

  logger.info("[AI-Cron] Starting AI Observability scheduler...");

  // ── Every 15 minutes ──
  // Evaluate alert rules (spikes, outages, error surges, latency anomalies)
  cron.schedule("*/15 * * * *", createJob("spike-detection", runAlertsJob));
  cron.schedule(
    "*/15 * * * *",
    createJob("vps-log-s3-archive", runVpsLogArchiveJob),
  );


  // ── Daily at 00:10 UTC ──
  // Roll up raw request logs into AiDailyMetric
  // Generate daily executive summary
  // Evaluate budget progress
  cron.schedule(
    "10 0 * * *",
    createJob("daily-rollup-and-summary", runRollupsJob),
  );

  // ── Daily at 00:30 UTC ──
  // Collect Bedrock CloudWatch metrics and Cost Explorer data for connected AWS accounts
  cron.schedule(
    "30 0 * * *",
    createJob("aws-ai-collector", runAwsAiCollectorJob),
  );

  // ── Weekly on Monday at 01:00 UTC ──
  // Generate weekly usage trends & optimization insights
  cron.schedule("0 1 * * 1", createJob("weekly-insights", runSummaryJob));

  cron.schedule(
    "0 9 * * *",
    createJob("usage-email-reports", runUsageReportJob),
  );


  logger.info("[AI-Cron] Scheduled jobs:");
  logger.info("   */15 * * * *   -> vps-log-s3-archive");
  logger.info(
    "   */15 * * * *   → spike-detection (alerts, anomalies, budget)",
  );

  logger.info("   10 0 * * *     → daily-rollup-and-summary");
  logger.info("   30 0 * * *     → aws-ai-collector (Bedrock metrics/costs)");
  logger.info("   0 1 * * 1      → weekly-insights");
}
