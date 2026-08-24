import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { getClientConfig } from "../../providers/client-factory";
import { AiRequestLog } from "../../../../models/ai-request-log.model";
import {
  BedrockConsoleOptions,
  BedrockConsoleMetrics,
  BedrockInvocationRow,
  AuthModeBreakdownRow,
  normalizeWindow,
  getWindowMinutes,
  normalizeRegion,
  getPeriodSeconds,
  buildMetricQuery,
  toSeries,
  pickNonEmptySeries,
  sumSeries,
  latestSeriesValue,
  getAuthMode,
  getDistributionBucket,
  mergeTokenSeries,
  mergeReliabilitySeries,
  mergeLatencySeries,
} from "./metric-helpers";

export async function getBedrockConsoleMetrics(
  userId: string,
  roleArn: string,
  externalId: string,
  options: BedrockConsoleOptions = {}
): Promise<BedrockConsoleMetrics> {
  const window = normalizeWindow(options.window);
  const windowMinutes = getWindowMinutes(window);
  const region = normalizeRegion(options.region);
  const modelId = options.modelId?.trim() || undefined;
  const limit = Math.min(Math.max(options.limit || 50, 1), 100);

  const periodSeconds = getPeriodSeconds(windowMinutes);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);

  const clientConfig = await getClientConfig(userId, region, roleArn, externalId);
  const cw = new CloudWatchClient(clientConfig);

  const metricQueries = [
    buildMetricQuery("invocations", "Invocations", "Sum", periodSeconds, modelId),
    buildMetricQuery("inputTokens", "InputTokenCount", "Sum", periodSeconds, modelId),
    buildMetricQuery("outputTokens", "OutputTokenCount", "Sum", periodSeconds, modelId),
    buildMetricQuery("throttles", "InvocationThrottles", "Sum", periodSeconds, modelId),
    buildMetricQuery("clientErrors", "InvocationClientErrors", "Sum", periodSeconds, modelId),
    buildMetricQuery("serverErrors", "InvocationServerErrors", "Sum", periodSeconds, modelId),
    buildMetricQuery("ttftPrimary", "TimeToFirstByte", "Average", periodSeconds, modelId),
    buildMetricQuery("ttftAlt", "TimeToFirstToken", "Average", periodSeconds, modelId),
    buildMetricQuery("latencyPrimary", "InvocationLatency", "Average", periodSeconds, modelId),
    buildMetricQuery("latencyAlt", "ModelLatency", "Average", periodSeconds, modelId),
  ];

  const response = await cw.send(
    new GetMetricDataCommand({
      StartTime: startTime,
      EndTime: endTime,
      MetricDataQueries: metricQueries,
      ScanBy: "TimestampAscending",
    })
  );

  const metricResults = new Map();
  for (const result of response.MetricDataResults || []) {
    if (result.Id) metricResults.set(result.Id, result);
  }

  const invocationsSeries = toSeries(metricResults.get("invocations"));
  const inputSeries = toSeries(metricResults.get("inputTokens"));
  const outputSeries = toSeries(metricResults.get("outputTokens"));
  const throttlesSeries = toSeries(metricResults.get("throttles"));
  const clientErrorsSeries = toSeries(metricResults.get("clientErrors"));
  const serverErrorsSeries = toSeries(metricResults.get("serverErrors"));
  const ttftSeries = pickNonEmptySeries(
    toSeries(metricResults.get("ttftPrimary")),
    toSeries(metricResults.get("ttftAlt"))
  );
  const endToEndSeries = pickNonEmptySeries(
    toSeries(metricResults.get("latencyPrimary")),
    toSeries(metricResults.get("latencyAlt"))
  );

  const inputTokens = Math.round(sumSeries(inputSeries));
  const outputTokens = Math.round(sumSeries(outputSeries));
  const totalTokens = inputTokens + outputTokens;
  const invocations = Math.round(sumSeries(invocationsSeries));
  const throttles = Math.round(sumSeries(throttlesSeries));
  const clientErrors = Math.round(sumSeries(clientErrorsSeries));
  const serverErrors = Math.round(sumSeries(serverErrorsSeries));
  const totalErrors = clientErrors + serverErrors;
  const estimatedTpm = windowMinutes > 0 ? Number((totalTokens / windowMinutes).toFixed(2)) : 0;
  const errorRatePct = invocations > 0 ? Number(((totalErrors / invocations) * 100).toFixed(2)) : 0;
  const throttleRatePct = invocations > 0 ? Number(((throttles / invocations) * 100).toFixed(2)) : 0;
  const timeToFirstTokenMs = latestSeriesValue(ttftSeries);
  const endToEndLatencyMs = latestSeriesValue(endToEndSeries);

  const query: Record<string, unknown> = {
    userId,
    provider: "bedrock",
    createdAt: { $gte: startTime },
  };
  if (modelId) {
    query.modelName = modelId;
  }

  const requestLogs = await AiRequestLog.find(query)
    .select("requestId modelName promptTokens completionTokens totalTokens latencyMs status errorMessage metadata createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const traceSample = await AiRequestLog.find(query)
    .select("promptTokens totalTokens status metadata")
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  const authModeMap = new Map<string, AuthModeBreakdownRow>();
  const distributionMap = new Map<string, number>();

  for (const row of traceSample) {
    const authMode = getAuthMode(row.metadata);
    const current = authModeMap.get(authMode) || {
      mode: authMode,
      requests: 0,
      tokens: 0,
      errors: 0,
    };
    current.requests += 1;
    current.tokens += row.totalTokens || 0;
    current.errors += row.status === "success" ? 0 : 1;
    authModeMap.set(authMode, current);

    const bucket = getDistributionBucket(row.promptTokens || 0);
    distributionMap.set(bucket, (distributionMap.get(bucket) || 0) + 1);
  }

  const authModes = Array.from(authModeMap.values()).sort((a, b) => b.requests - a.requests);
  const requestDistribution = ["<1K", "1K-4K", "4K-8K", "8K-16K", ">=16K"].map((bucket) => ({
    bucket,
    count: distributionMap.get(bucket) || 0,
  }));

  const invocationsTable: BedrockInvocationRow[] = requestLogs.map((row) => ({
    timestamp: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt as unknown as string).toISOString(),
    requestId: row.requestId,
    model: row.modelName,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    latencyMs: row.latencyMs,
    status: row.status,
    authMode: getAuthMode(row.metadata),
    errorMessage: row.errorMessage || undefined,
  }));

  const notes: string[] = [
    "CloudWatch Bedrock metrics are account/region scoped. Model filter only applies if ModelId dimensions are available.",
    "Auth mode (long_term/short_term) and invocation table are derived from traced request logs when your app posts /ai-observability/events.",
  ];
  if (region === "us-east-1" && options.region === "all") {
    notes.push("Region 'all' maps to us-east-1 for Bedrock console metrics.");
  }

  return {
    window,
    windowMinutes,
    region,
    modelId,
    cards: {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedTpm,
      invocations,
      throttles,
      clientErrors,
      serverErrors,
      totalErrors,
      errorRatePct,
      throttleRatePct,
      timeToFirstTokenMs,
      endToEndLatencyMs,
    },
    series: {
      tokens: mergeTokenSeries(inputSeries, outputSeries),
      reliability: mergeReliabilitySeries(invocationsSeries, throttlesSeries, clientErrorsSeries, serverErrorsSeries),
      latency: mergeLatencySeries(ttftSeries, endToEndSeries),
      requestDistribution,
    },
    authModes,
    invocations: invocationsTable,
    notes,
  };
}
