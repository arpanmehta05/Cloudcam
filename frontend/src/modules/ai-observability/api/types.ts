// ─── Types ───

export interface AiOverview {
  requestsToday: number;
  totalTokensToday: number;
  avgLatencyToday: number;
  totalCostToday: number;
  errorsToday: number;
  topProvider: string | null;
  topModel: string | null;
}

export interface TokenTrendRow {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostResult {
  dailyTrend: { date: string; cost: number }[];
  providerBreakdown: { provider: string; cost: number; requests: number }[];
  modelBreakdown: { provider: string; model: string; cost: number; requests: number; tokens: number }[];
  unpricedModels: UnpricedModelRow[];
  totalSpend: number;
  monthToDateSpend: number;
  avgDailySpend: number;
  projectedMonthlySpend: number;
  mostExpensiveProvider: string | null;
  mostExpensiveModel: string | null;
}

export type AiPricingSource = "provided" | "custom" | "default" | "unpriced";

export interface ModelRow {
  model: string;
  provider: string;
  requests: number;
  avgLatency: number;
  errorCount: number;
  totalTokens: number;
  totalCost: number;
}

export interface AiErrorRow {
  _id: string;
  userId: string;
  provider: string;
  modelName: string;
  requestId: string;
  status: string;
  errorMessage?: string;
  latencyMs: number;
  cost: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface BedrockCloudwatchErrorRow {
  timestamp: string;
  provider: "bedrock";
  status: "error";
  errorType: "client_error" | "server_error";
  errorCount: number;
  errorMessage: string;
  source: "cloudwatch";
}

export interface AiAlertRow {
  _id: string;
  userId: string;
  type: string;
  style?: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AiRequestTrace {
  _id: string;
  userId: string;
  provider: string;
  modelName: string;
  requestId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost: number;
  status: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetStatus {
  rule: {
    _id: string;
    monthlyLimit: number;
    dailyLimit: number | null;
    alertThresholdPercent: number;
    autoPause: boolean;
    enabled: boolean;
  };
  currentMonthSpend: number;
  currentDaySpend: number;
  monthlyUsagePercent: number;
  dailyUsagePercent: number | null;
  isMonthlyExceeded: boolean;
  isDailyExceeded: boolean;
  shouldPause: boolean;
}

export interface ForecastResult {
  monthToDateSpend: number;
  projectedMonthEndSpend: number;
  avgDailySpend: number;
  remainingBudgetDays: number | null;
  monthToDateTokens: number;
  projectedMonthEndTokens: number;
  avgDailyTokens: number;
  monthToDateRequests: number;
  projectedMonthEndRequests: number;
  avgDailyRequests: number;
  budgetLimit: number | null;
  budgetUsagePercent: number | null;
  daysUntilBudgetExceeded: number | null;
  elapsedDays: number;
  totalDays: number;
  generatedAt: string;
}

export interface DailySummary {
  date: string;
  requests: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  errorCount: number;
  errorRate: number;
  topProvider: string | null;
  topModel: string | null;
  bestLatencyProvider: string | null;
  alertsTriggered: number;
  costChangePercent: number | null;
  narrative: string;
  generatedAt: string;
}

export interface WeeklyInsight {
  type: "optimization" | "risk" | "trend" | "recommendation";
  title: string;
  message: string;
  priority: "low" | "medium" | "high";
  metadata?: Record<string, any>;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  insights: WeeklyInsight[];
  generatedAt: string;
}

export interface Anomaly {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  metadata: Record<string, any>;
  detectedAt: string;
}

export type BedrockWindow = "30m" | "3h" | "12h" | "24h";

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
    tokens: Array<{
      timestamp: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }>;
    reliability: Array<{
      timestamp: string;
      invocations: number;
      throttles: number;
      clientErrors: number;
      serverErrors: number;
    }>;
    latency: Array<{
      timestamp: string;
      timeToFirstTokenMs: number | null;
      endToEndLatencyMs: number | null;
    }>;
    requestDistribution: Array<{
      bucket: string;
      count: number;
    }>;
  };
  authModes: Array<{
    mode: string;
    requests: number;
    tokens: number;
    errors: number;
  }>;
  invocations: Array<{
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
  }>;
  notes: string[];
}

export interface RoutingRecommendation {
  endpoint: string | null;
  currentModel: string;
  suggestedModel: string;
  provider: string;
  requestsAffected: number;
  avgCompletionTokens: number;
  avgPromptTokens: number;
  currentCost: number;
  estimatedCost: number;
  monthlySavings: number;
  confidence: number;
  ruleTriggered: string;
}

export interface PromptInsight {
  endpoint: string | null;
  serviceName: string | null;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  promptRatio: number;
  requestCount: number;
  insightType: "fixed_prompt" | "prompt_completion_imbalance" | "duplicate_context";
  estimatedTokenSavings: number;
  estimatedCostSavings: number;
  message: string;
}

export interface AiIngestKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  token?: string;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface AiTraceRow {
  _id: string;
  traceId: string;
  name?: string;
  serviceName?: string;
  endpoint?: string;
  environment: string;
  sessionId?: string | null;
  endUserId?: string | null;
  level?: string;
  status: "success" | "error" | "partial";
  startedAt: string;
  endedAt?: string;
  durationMs: number;
  totalCost: number;
  totalTokens: number;
  errorCount: number;
  spanCount: number;
  unpricedSpanCount?: number;
  pricingSources?: AiPricingSource[];
  promptName?: string | null;
  promptSlug?: string | null;
  promptVersion?: string | null;
  promptLabel?: string | null;
  promptEnvironment?: string | null;
  promptState?: "draft" | "production" | "archived" | null;
  promptHash?: string | null;
  inputPreview?: string | null;
  outputPreview?: string | null;
  promptPreview?: string | null;
  previewSource?: {
    spanId?: string | null;
    requestId?: string | null;
    kind?: string | null;
    provider?: string | null;
    modelName?: string | null;
  } | null;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface AiTraceSpan {
  _id: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  environment?: string | null;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  serviceName?: string | null;
  endpoint?: string | null;
  sessionId?: string | null;
  endUserId?: string | null;
  kind: string;
  provider?: string;
  modelName?: string;
  status: string;
  level?: string;
  statusMessage?: string;
  startedAt: string;
  endedAt?: string;
  completionStartTime?: string | null;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  pricingSource?: AiPricingSource | null;
  pricingEstimated?: boolean | null;
  unpriced?: boolean;
  errorMessage?: string;
  inputPreview?: string;
  outputPreview?: string;
  promptHash?: string;
  promptName?: string | null;
  promptSlug?: string | null;
  promptVersion?: string | null;
  promptLabel?: string | null;
  promptEnvironment?: string | null;
  promptState?: "draft" | "production" | "archived" | null;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface AiRequestLogRow {
  _id?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  provider?: string;
  modelName?: string;
  status?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  cost?: number;
  pricingSource?: AiPricingSource | null;
  pricingEstimated?: boolean | null;
  unpriced?: boolean;
  promptName?: string | null;
  promptSlug?: string | null;
  promptVersion?: string | null;
  promptLabel?: string | null;
  promptEnvironment?: string | null;
  promptHash?: string | null;
  inputPreview?: string;
  outputPreview?: string;
  metadata?: Record<string, any>;
}

export interface TraceScoreRow {
  _id: string;
  targetType: string;
  targetId: string;
  traceId?: string | null;
  spanId?: string | null;
  requestId?: string | null;
  scoreConfigId?: string | null;
  dataType?: ScoreDataType | null;
  score?: number | null;
  stringValue?: string | null;
  boolValue?: boolean | null;
  sentiment?: "positive" | "neutral" | "negative" | null;
  source?: string;
  comment?: string;
  tags?: string[];
  createdAt?: string;
}

export type ObservationFieldGroup = "core" | "basic" | "usage" | "input" | "output" | "metadata";

export interface ObservationQueryParams {
  traceId?: string;
  sessionId?: string;
  endUserId?: string;
  kind?: string;
  provider?: string;
  modelName?: string;
  status?: string;
  level?: string;
  environment?: string;
  serviceName?: string;
  endpoint?: string;
  promptName?: string;
  promptSlug?: string;
  promptVersion?: string;
  promptLabel?: string;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  minCost?: number;
  maxCost?: number;
  tag?: string;
  fields?: ObservationFieldGroup[];
  limit?: number;
  cursor?: string;
}

export interface AiTraceDetail {
  trace: AiTraceRow & { metadata?: Record<string, any> };
  spans: AiTraceSpan[];
  requests: AiRequestLogRow[];
  scores?: TraceScoreRow[];
}

export interface AiSessionRow {
  sessionId: string;
  traceCount: number;
  totalCost: number;
  totalTokens: number;
  errorCount: number;
  durationMs: number;
  startedAt: string;
  lastSeenAt: string;
  endUserIds: string[];
}

export interface AiEndUserRow {
  endUserId: string;
  traceCount: number;
  sessionIds: string[];
  totalCost: number;
  totalTokens: number;
  errorCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export type ScoreDataType = "numeric" | "categorical" | "boolean" | "text";

export interface ScoreConfig {
  _id: string;
  name: string;
  dataType: ScoreDataType;
  minValue?: number | null;
  maxValue?: number | null;
  categories: string[];
  description?: string;
}

export interface CustomModelPrice {
  _id: string;
  provider: string;
  modelName: string;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  matchPattern: "exact" | "prefix" | "regex";
  isActive: boolean;
}

export interface UnpricedModelRow {
  provider: string;
  model: string;
  requests: number;
  tokens: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  traceIds?: string[];
}

export type AiSavedViewType = "traces" | "observations";

export interface AiSavedView {
  _id: string;
  name: string;
  viewType: AiSavedViewType;
  query: string;
  filters: Record<string, unknown>;
  columns: string[];
  sort: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiSavedViewInput {
  name?: string;
  viewType?: AiSavedViewType;
  query?: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort?: Record<string, unknown>;
  isDefault?: boolean;
}

export type CostDimension = "prompt" | "user" | "session" | "endpoint" | "model" | "service";

export interface CostAttributionRow {
  key: Record<string, string | null>;
  cost: number;
  requests: number;
  tokens: number;
  errors: number;
  avgLatencyMs: number;
}

export interface CostAttributionResult {
  dimension: CostDimension;
  windowDays: number;
  rows: CostAttributionRow[];
}

export interface EvaluationCostSummary {
  windowDays: number;
  judgeRuns: number;
  estimatedJudgeCost: number;
  experimentRuns: number;
  experimentItemCost: number;
  totalEvaluationCost: number;
}
