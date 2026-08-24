import { AiTraceSpan } from "../../../models/ai-trace-span.model";
import { AiEvaluation } from "../../../models/ai-evaluation.model";
import { estimateCost } from "../../../config/ai-pricing";
import type { AiScope } from "../services/scope.service";

export type CostDimension = "prompt" | "user" | "session" | "endpoint" | "model" | "service";

const GROUP_KEYS: Record<CostDimension, Record<string, string>> = {
  prompt: { slug: "$promptSlug", version: "$promptVersion", label: "$promptLabel" },
  user: { user: "$endUserId" },
  session: { session: "$sessionId" },
  endpoint: { endpoint: "$endpoint" },
  model: { provider: "$provider", model: "$model" },
  service: { service: "$serviceName" },
};

export interface CostAttributionRow {
  key: Record<string, string | null>;
  cost: number;
  requests: number;
  tokens: number;
  errors: number;
  avgLatencyMs: number;
}

function spanScopeMatch(scope: AiScope, since: Date): Record<string, unknown> {
  const match: Record<string, unknown> = { userId: scope.userId, startedAt: { $gte: since } };
  if (scope.workspaceId) match.workspaceId = scope.workspaceId;
  if (scope.environment) match.environment = scope.environment;
  return match;
}

/**
 * Build the aggregation pipeline for cost attribution by a dimension. Pure and
 * testable — the group key is derived from the dimension.
 */
export function buildCostAttributionPipeline(
  scope: AiScope,
  dimension: CostDimension,
  since: Date,
  limit = 50,
): Record<string, unknown>[] {
  const groupId = GROUP_KEYS[dimension];
  const match = spanScopeMatch(scope, since);
  // Only include spans that carry the grouping dimension.
  const firstKey = Object.values(groupId)[0].replace("$", "");
  match[firstKey] = { $ne: null };

  return [
    { $match: match },
    {
      $group: {
        _id: groupId,
        cost: { $sum: { $ifNull: ["$cost", 0] } },
        requests: { $sum: 1 },
        tokens: { $sum: { $ifNull: ["$totalTokens", 0] } },
        errors: { $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] } },
        avgLatencyMs: { $avg: { $ifNull: ["$durationMs", 0] } },
      },
    },
    { $sort: { cost: -1 } },
    { $limit: Math.min(Math.max(limit, 1), 200) },
  ];
}

export async function getCostAttribution(
  scope: AiScope,
  dimension: CostDimension,
  windowDays = 30,
  limit = 50,
): Promise<{ dimension: CostDimension; windowDays: number; rows: CostAttributionRow[] }> {
  const days = Math.min(Math.max(windowDays, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pipeline = buildCostAttributionPipeline(scope, dimension, since, limit);
  const grouped = await AiTraceSpan.aggregate(pipeline as never[]);

  const rows: CostAttributionRow[] = grouped.map((row: Record<string, any>) => ({
    key: row._id || {},
    cost: Number((row.cost || 0).toFixed(6)),
    requests: row.requests || 0,
    tokens: row.tokens || 0,
    errors: row.errors || 0,
    avgLatencyMs: Math.round(row.avgLatencyMs || 0),
  }));

  return { dimension, windowDays: days, rows };
}

export interface EvaluationCostSummary {
  windowDays: number;
  judgeRuns: number;
  estimatedJudgeCost: number;
  totalEvaluationCost: number;
}

/**
 * Cost of evaluation activity: LLM-judge runs estimated from judge model.
 */
export async function getEvaluationCost(
  scope: AiScope,
  windowDays = 30,
): Promise<EvaluationCostSummary> {
  const days = Math.min(Math.max(windowDays, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const evaluations = await AiEvaluation.find({ userId: scope.userId, createdAt: { $gte: since } })
    .select("judgeModel")
    .lean();
  // Judge runs don't persist token counts; estimate a nominal judge call cost.
  const estimatedJudgeCost = evaluations.reduce((sum, evaluation) => {
    const estimate = estimateCost("openai", evaluation.judgeModel || "gpt-4o-mini", 800, 200);
    return sum + (estimate.cost || 0);
  }, 0);

  return {
    windowDays: days,
    judgeRuns: evaluations.length,
    estimatedJudgeCost: Number(estimatedJudgeCost.toFixed(6)),
    totalEvaluationCost: Number(estimatedJudgeCost.toFixed(6)),
  };
}
