import { AiTraceSpan } from "../../../models/ai-trace-span.model";
import { AiScope, buildScopeMatch } from "../services/scope.service";

// A span counts as a billable "model call" only when it carries a real model
// name. Steps like chains/tools/retrieval have modelName "unknown" (or null)
// and must not appear as models. Keeping this in one place so Model Usage,
// Cost & Tokens, and the Overview all agree on what a model call is.
export const REAL_MODEL_MATCH = { modelName: { $nin: [null, "", "unknown"] } } as const;

export interface ModelPerformanceRow {
  model: string;
  provider: string;
  requests: number;
  avgLatency: number;
  errorCount: number;
  totalTokens: number;
  totalCost: number;
}

function parseDateRange(range?: string): Date {
  const cutoff = new Date();
  const normalized = (range || "30d").trim().toLowerCase();
  const dayMatch = normalized.match(/^(\d+)d$/);
  const hourMatch = normalized.match(/^(\d+)h$/);

  if (hourMatch) {
    cutoff.setHours(cutoff.getHours() - parseInt(hourMatch[1], 10));
    return cutoff;
  }

  const days = dayMatch ? parseInt(dayMatch[1], 10) : 30;
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

export async function getModelPerformance(
  scope: AiScope,
  range?: string,
  provider?: string,
): Promise<ModelPerformanceRow[]> {
  const cutoff = parseDateRange(range || "30d");
  const providerFilter = provider && provider !== "all" ? { provider } : {};
  const scopeMatch = buildScopeMatch(scope);

  // Aggregate over spans (not just kind:"llm" request logs) so every model that
  // appears in a trace — LLM, embedding, reranker, custom generation — is
  // surfaced. Non-model steps are excluded via REAL_MODEL_MATCH.
  return AiTraceSpan.aggregate([
    {
      $match: {
        ...scopeMatch,
        startedAt: { $gte: cutoff },
        ...REAL_MODEL_MATCH,
        ...providerFilter,
      },
    },
    {
      $group: {
        _id: "$modelName",
        provider: { $first: "$provider" },
        requests: { $sum: 1 },
        avgLatency: { $avg: "$durationMs" },
        errorCount: { $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] } },
        totalTokens: { $sum: "$totalTokens" },
        totalCost: { $sum: "$cost" },
      },
    },
    { $sort: { requests: -1 } },
    {
      $project: {
        _id: 0,
        model: "$_id",
        provider: 1,
        requests: 1,
        avgLatency: { $round: ["$avgLatency", 0] },
        errorCount: 1,
        totalTokens: 1,
        totalCost: { $round: ["$totalCost", 4] },
      },
    },
  ]);
}
