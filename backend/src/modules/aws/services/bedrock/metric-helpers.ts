import { type MetricDataQuery, type MetricDataResult } from "@aws-sdk/client-cloudwatch";

export interface BedrockDayMetric {
  date: string;
  invocations: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  errors: number;
}

export type BedrockWindow = "30m" | "3h" | "12h" | "24h";

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface MetricTriplePoint {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ReliabilityPoint {
  timestamp: string;
  invocations: number;
  throttles: number;
  clientErrors: number;
  serverErrors: number;
}

export interface LatencyPoint {
  timestamp: string;
  timeToFirstTokenMs: number | null;
  endToEndLatencyMs: number | null;
}

export interface DistributionBucket {
  bucket: string;
  count: number;
}

export interface AuthModeBreakdownRow {
  mode: string;
  requests: number;
  tokens: number;
  errors: number;
}

export interface BedrockInvocationRow {
  timestamp: string;
  requestId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: string;
  authMode: string;
  errorMessage?: string;
}

export interface BedrockConsoleMetrics {
  window: BedrockWindow;
  windowMinutes: number;
  region: string;
  modelId?: string;
  cards: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedTpm: number;
    invocations: number;
    throttles: number;
    clientErrors: number;
    serverErrors: number;
    totalErrors: number;
    errorRatePct: number;
    throttleRatePct: number;
    timeToFirstTokenMs: number | null;
    endToEndLatencyMs: number | null;
  };
  series: {
    tokens: MetricTriplePoint[];
    reliability: ReliabilityPoint[];
    latency: LatencyPoint[];
    requestDistribution: DistributionBucket[];
  };
  authModes: AuthModeBreakdownRow[];
  invocations: BedrockInvocationRow[];
  notes: string[];
}

export interface BedrockConsoleOptions {
  region?: string;
  window?: string;
  modelId?: string;
  limit?: number;
}

export function normalizeWindow(value?: string): BedrockWindow {
  if (value === "30m" || value === "3h" || value === "12h" || value === "24h") {
    return value;
  }
  return "12h";
}

export function getWindowMinutes(window: BedrockWindow): number {
  if (window === "30m") return 30;
  if (window === "3h") return 180;
  if (window === "24h") return 1440;
  return 720;
}

export function getPeriodSeconds(windowMinutes: number): number {
  if (windowMinutes <= 60) return 60;
  if (windowMinutes <= 360) return 300;
  if (windowMinutes <= 720) return 600;
  return 900;
}

export function normalizeRegion(region?: string): string {
  if (!region || region === "all") return "us-east-1";
  return region;
}

export function buildMetricQuery(
  id: string,
  metricName: string,
  stat: "Sum" | "Average",
  periodSeconds: number,
  modelId?: string
): MetricDataQuery {
  const dimensions = modelId ? [{ Name: "ModelId", Value: modelId }] : [];
  return {
    Id: id,
    MetricStat: {
      Metric: {
        Namespace: "AWS/Bedrock",
        MetricName: metricName,
        Dimensions: dimensions,
      },
      Period: periodSeconds,
      Stat: stat,
    },
  };
}

export function toSeries(metric?: MetricDataResult): MetricPoint[] {
  const timestamps = metric?.Timestamps || [];
  const values = metric?.Values || [];
  const points: MetricPoint[] = [];

  const length = Math.min(timestamps.length, values.length);
  for (let i = 0; i < length; i++) {
    const ts = timestamps[i];
    const val = values[i];
    if (!ts || val === undefined || val === null) continue;
    points.push({ timestamp: ts.toISOString(), value: Number(val) });
  }

  points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return points;
}

export function sumSeries(points: MetricPoint[]): number {
  return points.reduce((acc, p) => acc + p.value, 0);
}

export function latestSeriesValue(points: MetricPoint[]): number | null {
  if (points.length === 0) return null;
  return points[points.length - 1].value;
}

export function pickNonEmptySeries(primary: MetricPoint[], fallback: MetricPoint[]): MetricPoint[] {
  if (primary.length > 0 && sumSeries(primary) > 0) return primary;
  if (primary.length > 0 && fallback.length === 0) return primary;
  return fallback;
}

export function getAuthMode(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "unknown";
  const raw = metadata as Record<string, unknown>;
  const value =
    raw.authMode ||
    (raw.awsAuth && typeof raw.awsAuth === "object" ? (raw.awsAuth as Record<string, unknown>).mode : undefined) ||
    (raw.auth && typeof raw.auth === "object" ? (raw.auth as Record<string, unknown>).mode : undefined) ||
    raw.auth_mode;
  if (typeof value !== "string") return "unknown";
  const mode = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (mode === "short_term" || mode === "short-term" || mode === "shortterm") return "short_term";
  if (mode === "long_term" || mode === "long-term" || mode === "longterm") return "long_term";
  return "unknown";
}

export function getDistributionBucket(promptTokens: number): string {
  if (promptTokens < 1000) return "<1K";
  if (promptTokens < 4000) return "1K-4K";
  if (promptTokens < 8000) return "4K-8K";
  if (promptTokens < 16000) return "8K-16K";
  return ">=16K";
}

export function mergeTokenSeries(input: MetricPoint[], output: MetricPoint[]): MetricTriplePoint[] {
  const inputMap = new Map(input.map((p) => [p.timestamp, p.value]));
  const outputMap = new Map(output.map((p) => [p.timestamp, p.value]));
  const timestamps = new Set<string>([...inputMap.keys(), ...outputMap.keys()]);
  return Array.from(timestamps)
    .sort((a, b) => a.localeCompare(b))
    .map((timestamp) => {
      const inputTokens = inputMap.get(timestamp) || 0;
      const outputTokens = outputMap.get(timestamp) || 0;
      return {
        timestamp,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      };
    });
}

export function mergeReliabilitySeries(
  invocations: MetricPoint[],
  throttles: MetricPoint[],
  clientErrors: MetricPoint[],
  serverErrors: MetricPoint[]
): ReliabilityPoint[] {
  const invMap = new Map(invocations.map((p) => [p.timestamp, p.value]));
  const throttleMap = new Map(throttles.map((p) => [p.timestamp, p.value]));
  const clientMap = new Map(clientErrors.map((p) => [p.timestamp, p.value]));
  const serverMap = new Map(serverErrors.map((p) => [p.timestamp, p.value]));
  const timestamps = new Set<string>([
    ...invMap.keys(),
    ...throttleMap.keys(),
    ...clientMap.keys(),
    ...serverMap.keys(),
  ]);

  return Array.from(timestamps)
    .sort((a, b) => a.localeCompare(b))
    .map((timestamp) => ({
      timestamp,
      invocations: invMap.get(timestamp) || 0,
      throttles: throttleMap.get(timestamp) || 0,
      clientErrors: clientMap.get(timestamp) || 0,
      serverErrors: serverMap.get(timestamp) || 0,
    }));
}

export function mergeLatencySeries(ttft: MetricPoint[], endToEnd: MetricPoint[]): LatencyPoint[] {
  const ttftMap = new Map(ttft.map((p) => [p.timestamp, p.value]));
  const e2eMap = new Map(endToEnd.map((p) => [p.timestamp, p.value]));
  const timestamps = new Set<string>([...ttftMap.keys(), ...e2eMap.keys()]);

  return Array.from(timestamps)
    .sort((a, b) => a.localeCompare(b))
    .map((timestamp) => ({
      timestamp,
      timeToFirstTokenMs: ttftMap.has(timestamp) ? (ttftMap.get(timestamp) || 0) : null,
      endToEndLatencyMs: e2eMap.has(timestamp) ? (e2eMap.get(timestamp) || 0) : null,
    }));
}
