import { AiTraceSpan } from "../../../models/ai-trace-span.model";
import { AiScope, buildScopeMatch } from "../services/scope.service";
import { REAL_MODEL_MATCH } from "../model-usage/model-usage.service";

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
  unpricedModels: { provider: string; model: string; requests: number; tokens: number }[];
  totalSpend: number;
  monthToDateSpend: number;
  avgDailySpend: number;
  projectedMonthlySpend: number;
  mostExpensiveProvider: string | null;
  mostExpensiveModel: string | null;
}

function parseDateRange(range?: string): Date {
  const cutoff = new Date();
  const normalized = (range || "7d").trim().toLowerCase();
  const dayMatch = normalized.match(/^(\d+)d$/);
  const hourMatch = normalized.match(/^(\d+)h$/);

  if (hourMatch) {
    cutoff.setHours(cutoff.getHours() - parseInt(hourMatch[1], 10));
    return cutoff;
  }

  const days = dayMatch ? parseInt(dayMatch[1], 10) : 7;
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

function startOfMonthDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function elapsedDaysInMonth(): number {
  return new Date().getDate();
}

export async function getTokenTrends(
  scope: AiScope,
  range?: string,
  provider?: string,
): Promise<TokenTrendRow[]> {
  const cutoff = parseDateRange(range);
  const providerFilter = provider && provider !== "all" ? { provider } : {};
  const scopeMatch = buildScopeMatch(scope);

  return AiTraceSpan.aggregate([
    { $match: { ...scopeMatch, startedAt: { $gte: cutoff }, ...REAL_MODEL_MATCH, ...providerFilter } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
        promptTokens: { $sum: "$promptTokens" },
        completionTokens: { $sum: "$completionTokens" },
        totalTokens: { $sum: "$totalTokens" },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", promptTokens: 1, completionTokens: 1, totalTokens: 1 } },
  ]);
}

export async function getCostTrends(
  scope: AiScope,
  range?: string,
  provider?: string,
): Promise<CostResult> {
  const cutoff = parseDateRange(range || "30d");
  const providerFilter = provider && provider !== "all" ? { provider } : {};
  const scopeMatch = buildScopeMatch(scope);
  // Single source of truth: spans. Every real model call counts, matching the
  // Cost Attribution panel (which already reads spans) so the page reconciles.
  const spanMatch = { ...scopeMatch, startedAt: { $gte: cutoff }, ...REAL_MODEL_MATCH, ...providerFilter };

  const dailyTrend = await AiTraceSpan.aggregate([
    { $match: spanMatch },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
        cost: { $sum: "$cost" },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", cost: { $round: ["$cost", 6] } } },
  ]);

  const providerBreakdown = await AiTraceSpan.aggregate([
    { $match: spanMatch },
    {
      $group: {
        _id: "$provider",
        cost: { $sum: "$cost" },
        requests: { $sum: 1 },
      },
    },
    { $sort: { cost: -1 } },
    { $project: { _id: 0, provider: "$_id", cost: { $round: ["$cost", 6] }, requests: 1 } },
  ]);

  const modelBreakdown = await AiTraceSpan.aggregate([
    { $match: spanMatch },
    {
      $group: {
        _id: { provider: "$provider", model: "$modelName" },
        cost: { $sum: "$cost" },
        requests: { $sum: 1 },
        tokens: { $sum: "$totalTokens" },
      },
    },
    { $sort: { cost: -1, requests: -1 } },
    { $limit: 20 },
    {
      $project: {
        _id: 0,
        provider: "$_id.provider",
        model: "$_id.model",
        cost: { $round: ["$cost", 6] },
        requests: 1,
        tokens: 1,
      },
    },
  ]);

  const unpricedModels = await AiTraceSpan.aggregate([
    { $match: { ...spanMatch, totalTokens: { $gt: 0 }, unpriced: true } },
    {
      $group: {
        _id: { provider: "$provider", model: "$modelName" },
        requests: { $sum: 1 },
        tokens: { $sum: "$totalTokens" },
      },
    },
    { $sort: { tokens: -1, requests: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        provider: "$_id.provider",
        model: "$_id.model",
        requests: 1,
        tokens: 1,
      },
    },
  ]);

  const totalSpend = providerBreakdown.reduce((sum: number, p: any) => sum + p.cost, 0);
  const mostExpensiveProvider = providerBreakdown.length > 0 ? providerBreakdown[0].provider : null;
  const mostExpensiveModel = modelBreakdown.length > 0 ? modelBreakdown[0].model : null;
  const avgDailySpend =
    dailyTrend.length > 0
      ? Math.round((totalSpend / dailyTrend.length) * 1_000_000) / 1_000_000
      : 0;

  const monthAgg = await AiTraceSpan.aggregate([
    { $match: { ...scopeMatch, startedAt: { $gte: startOfMonthDate() }, ...REAL_MODEL_MATCH, ...providerFilter } },
    { $group: { _id: null, cost: { $sum: "$cost" } } },
  ]);
  const monthToDateSpend = monthAgg[0]?.cost || 0;
  const elapsed = elapsedDaysInMonth();
  const projectedMonthlySpend =
    elapsed > 0
      ? Math.round(((monthToDateSpend / elapsed) * daysInCurrentMonth()) * 100) / 100
      : 0;

  return {
    dailyTrend,
    providerBreakdown,
    modelBreakdown,
    unpricedModels,
    totalSpend: Math.round(totalSpend * 1_000_000) / 1_000_000,
    monthToDateSpend: Math.round(monthToDateSpend * 1_000_000) / 1_000_000,
    avgDailySpend,
    projectedMonthlySpend,
    mostExpensiveProvider,
    mostExpensiveModel,
  };
}
