import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type {
  BudgetStatus,
  CostAttributionResult,
  CostDimension,
  CostResult,
  EvaluationCostSummary,
  TokenTrendRow,
} from "../api/types";

export type {
  BudgetStatus,
  CostAttributionResult,
  CostAttributionRow,
  CostDimension,
  CostResult,
  EvaluationCostSummary,
  TokenTrendRow,
} from "../api/types";

export async function getTokens(range: string = "7d", provider?: string): Promise<TokenTrendRow[]> {
  const search = new URLSearchParams();
  search.set("range", range);
  if (provider && provider !== "all") search.set("provider", provider);
  const data = await fetchAiJson<{ success: boolean; trend: TokenTrendRow[] }>(
    `${AI_OBSERVABILITY_BASE}/tokens?${search.toString()}`,
  );
  return data.trend;
}

export async function getCosts(range: string = "30d", provider?: string): Promise<CostResult> {
  const search = new URLSearchParams();
  search.set("range", range);
  if (provider && provider !== "all") search.set("provider", provider);
  const data = await fetchAiJson<{ success: boolean } & CostResult>(
    `${AI_OBSERVABILITY_BASE}/costs?${search.toString()}`,
  );
  return {
    dailyTrend: data.dailyTrend,
    providerBreakdown: data.providerBreakdown,
    modelBreakdown: data.modelBreakdown || [],
    unpricedModels: data.unpricedModels || [],
    totalSpend: data.totalSpend,
    monthToDateSpend: data.monthToDateSpend || 0,
    avgDailySpend: data.avgDailySpend || 0,
    projectedMonthlySpend: data.projectedMonthlySpend,
    mostExpensiveProvider: data.mostExpensiveProvider,
    mostExpensiveModel: data.mostExpensiveModel || null,
  };
}

export async function getBudget(): Promise<BudgetStatus | null> {
  const data = await fetchAiJson<{ success: boolean; budget: BudgetStatus | null }>(`${AI_OBSERVABILITY_BASE}/budget`);
  return data.budget;
}

export async function getCostAttribution(dimension: CostDimension, days = 30): Promise<CostAttributionResult> {
  const data = await fetchAiJson<{ success: boolean } & CostAttributionResult>(
    `${AI_OBSERVABILITY_BASE}/costs/attribution?dimension=${dimension}&days=${days}`,
  );
  return { dimension: data.dimension, windowDays: data.windowDays, rows: data.rows || [] };
}

export async function getEvaluationCost(days = 30): Promise<EvaluationCostSummary> {
  const data = await fetchAiJson<{ success: boolean; summary: EvaluationCostSummary }>(
    `${AI_OBSERVABILITY_BASE}/costs/evaluation?days=${days}`,
  );
  return data.summary;
}
