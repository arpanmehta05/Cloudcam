import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { RoutingRecommendation } from "../api/types";

export type { RoutingRecommendation };

export async function getRoutingRecommendations(): Promise<{
  recommendations: RoutingRecommendation[];
  totalMonthlySavings: number;
}> {
  const data = await fetchAiJson<{
    success: boolean;
    recommendations: RoutingRecommendation[];
    totalMonthlySavings: number;
  }>(`${AI_OBSERVABILITY_BASE}/recommendations/routing`);
  return { recommendations: data.recommendations, totalMonthlySavings: data.totalMonthlySavings };
}
