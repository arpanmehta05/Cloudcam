import { logger } from "../core/logger";
// ─── AWS AI Metrics Collector Job ───
// Runs daily via cron. For each user with AI Observability enabled:
//   1. Assumes their cross-account role
//   2. Fetches Bedrock CloudWatch metrics + Cost Explorer data
//   3. Writes normalized data into AiDailyMetric
//
// Integrates with the AI Observability cron scheduler.

import { User } from "../models/user.model";
import { syncBedrockMetrics } from "../services/aws/bedrock-metrics.service";
import { config } from "../config/env";

// ─── Helpers ───

/**
 * Get all users who have:
 *   1. AWS connected (roleArn present)
 *   2. AI Observability module enabled
 */
async function getAiObsUsers(): Promise<
  Array<{
    userId: string;
    roleArn: string;
    externalId: string;
  }>
> {
  const users = await User.find({
    "awsCredentials.roleArn": { $exists: true, $ne: null },
    $or: [
      // Preferred: explicit module selection includes AI observability
      { "awsCredentials.enabledModules": "ai-observability" },
      // Backward compatibility: older records may not have enabledModules set
      { "awsCredentials.enabledModules": { $exists: false } },
      { "awsCredentials.enabledModules": null },
      { "awsCredentials.enabledModules": { $size: 0 } },
    ],
  })
    .select("_id awsCredentials")
    .lean();

  return users
    .filter(
      (u: any) => u.awsCredentials?.roleArn && u.awsCredentials?.externalId,
    )
    .map((u: any) => ({
      userId: u._id.toString(),
      roleArn: u.awsCredentials.roleArn,
      externalId: u.awsCredentials.externalId,
    }));
}

// ─── Main Job ───

/**
 * Collect Bedrock metrics for all eligible users.
 * Called by the AI Observability cron scheduler (daily at 00:30 UTC).
 */
export async function runAwsAiCollectorJob(): Promise<void> {
  if (!config.aiObservability.enabled) {
    logger.info("[AWS-AI-Collector] AI Observability disabled, skipping");
    return;
  }

  if (!config.aiObservability.bedrockMonitoring) {
    logger.info("[AWS-AI-Collector] Bedrock monitoring disabled, skipping");
    return;
  }

  const users = await getAiObsUsers();
  if (users.length === 0) {
    logger.info(
      "[AWS-AI-Collector] No users with AI Observability enabled, skipping",
    );
    return;
  }

  logger.info(
    `[AWS-AI-Collector] Collecting Bedrock metrics for ${users.length} users`,
  );

  let totalMetrics = 0;
  let totalCosts = 0;
  let errorCount = 0;

  // Bedrock regions to check — configurable, but us-east-1 is most common
  const regions = ["us-east-1", "us-west-2", "eu-west-1", "ap-northeast-1"];

  for (const user of users) {
    try {
      for (const region of regions) {
        const result = await syncBedrockMetrics(
          user.userId,
          user.roleArn,
          user.externalId,
          region,
          1, // yesterday only
        );
        totalMetrics += result.metricsWritten;
        totalCosts += result.costsWritten;
      }
    } catch (err: any) {
      errorCount++;
      logger.error(
        `[AWS-AI-Collector] Error for user ${user.userId}:`,
        err.message,
      );
      // Continue with other users — don't let one failure stop the batch
    }
  }

  logger.info(
    `[AWS-AI-Collector] Complete: ${totalMetrics} metric rows, ${totalCosts} cost rows, ${errorCount} errors`,
  );
}
