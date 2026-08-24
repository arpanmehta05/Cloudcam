import { useState, useEffect, useCallback, useRef } from "react";
import {
  aiObservabilityApi,
  type AiOverview,
  type TokenTrendRow,
  type CostResult,
  type ModelRow,
  type RoutingRecommendation,
  type PromptInsight,
  type AiTraceRow,
} from "../../api/ai-observability.api";

export function useOverviewMetrics(provider: string, dateRange: string) {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [overview, setOverview] = useState<AiOverview | null>(null);
  const [tokens, setTokens] = useState<TokenTrendRow[]>([]);
  const [costs, setCosts] = useState<CostResult | null>(null);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [routing, setRouting] = useState<{ recommendations: RoutingRecommendation[]; totalMonthlySavings: number } | null>(null);
  const [promptInsights, setPromptInsights] = useState<PromptInsight[]>([]);
  const [latestTraces, setLatestTraces] = useState<AiTraceRow[]>([]);
  const requestVersionRef = useRef(0);

  const fetchMetrics = useCallback(async () => {
    const currentVersion = ++requestVersionRef.current;
    setLoading(true);

    try {
      const [
        nextOverview,
        nextTokens,
        nextCosts,
        nextModels,
        nextRouting,
        nextPrompts,
        nextTraces,
      ] = await Promise.all([
        aiObservabilityApi.getOverview(provider, dateRange).catch(() => null),
        aiObservabilityApi.getTokens(dateRange, provider).catch(() => []),
        aiObservabilityApi.getCosts(dateRange === "24h" ? "7d" : dateRange, provider).catch(() => null),
        aiObservabilityApi.getModels(dateRange, provider).catch(() => []),
        aiObservabilityApi.getRoutingRecommendations().catch(() => null),
        aiObservabilityApi.getPromptInsights().catch(() => []),
        aiObservabilityApi.listTraces({ limit: 5 }).catch(() => ({ traces: [] })),
      ]);

      if (currentVersion !== requestVersionRef.current) return;

      setOverview(nextOverview);
      setTokens(nextTokens);
      setCosts(nextCosts);
      setModels(nextModels);
      setRouting(nextRouting);
      setPromptInsights(nextPrompts);
      setLatestTraces(nextTraces.traces || []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("[useOverviewMetrics] Fetch error:", err);
    } finally {
      if (currentVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [provider, dateRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    loading,
    lastUpdated,
    overview,
    tokens,
    costs,
    models,
    routing,
    promptInsights,
    latestTraces,
    refresh: fetchMetrics,
  };
}
