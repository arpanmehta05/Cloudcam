import { config } from "../../../core/config";
import { AiDailyMetric } from "../../../models/ai-daily-metric.model";
import { fetchBedrockCloudWatchMetrics } from "./bedrock/metric-fetcher";
import { fetchBedrockCosts } from "./bedrock/cost-estimator";

export * from "./bedrock/metric-fetcher";
export * from "./bedrock/cost-estimator";

/**
 * Merge CloudWatch metrics and cost data into AiDailyMetric for display.
 * Uses upsert for idempotency.
 */
export async function syncBedrockMetrics(
  userId: string,
  roleArn: string,
  externalId: string,
  region: string = "us-east-1",
  daysBack: number = 1
): Promise<{ metricsWritten: number; costsWritten: number }> {
  if (!config.aiObservability.bedrockMonitoring) {
    console.log("[Bedrock-Metrics] Bedrock monitoring disabled, skipping");
    return { metricsWritten: 0, costsWritten: 0 };
  }

  // 1. Fetch CloudWatch metrics
  const metrics = await fetchBedrockCloudWatchMetrics(userId, roleArn, externalId, region, daysBack);

  let metricsWritten = 0;
  const defaultScope = {
    tenantId: null,
    workspaceId: null,
    environment: "prod",
  };

  for (const m of metrics) {
    if (m.invocations === 0) continue;

    await AiDailyMetric.updateOne(
      { userId, ...defaultScope, date: m.date, provider: "bedrock" },
      {
        $set: {
          requests: m.invocations,
          promptTokens: m.inputTokens,
          completionTokens: m.outputTokens,
          totalTokens: m.inputTokens + m.outputTokens,
          avgLatencyMs: m.latencyMs,
          errorCount: m.errors,
        },
        $setOnInsert: defaultScope,
      },
      { upsert: true }
    );
    metricsWritten++;
  }

  // 2. Fetch costs and merge
  const costs = await fetchBedrockCosts(userId, roleArn, externalId, daysBack);

  let costsWritten = 0;
  for (const c of costs) {
    await AiDailyMetric.updateOne(
      { userId, ...defaultScope, date: c.date, provider: "bedrock" },
      {
        $set: { totalCost: Math.round(c.cost * 10000) / 10000 },
        $setOnInsert: defaultScope,
      },
      { upsert: true }
    );
    costsWritten++;
  }

  console.log(`[Bedrock-Metrics] User ${userId}: ${metricsWritten} metric rows, ${costsWritten} cost rows synced`);
  return { metricsWritten, costsWritten };
}
