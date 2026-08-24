"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { authFetch, ApiClientError } from "@/lib/auth-fetch";
import { ACTION_EXECUTION_EVENT } from "@/lib/action-events";
import { getCloudRecommendations } from "@/lib/cloud/api";
import { getCloudProviderIds } from "@/lib/cloud/provider-registry";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import type { CloudProvider } from "@/lib/regions";
import type { Insights, Metrics, Recommendation, CachedData, ProviderFilter } from "./types";
import { normalizeRecommendation, buildSimulationDraftFromRecommendation } from "./helpers";
import { useAuth } from "@/context/AuthContext";

const CACHE_KEY = "rabbittize_multicloud_insights";
const CACHE_VERSION = 3;
const PROVIDERS = getCloudProviderIds();

export function useRecommendations() {
  const { user } = useAuth();
  const cacheKey = useMemo(() => {
    return user ? `rabbittize_multicloud_insights_${user.id}` : null;
  }, [user]);

  const [insights, setInsights] = useState<Insights | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    actionId: string;
    targets: { resourceId: string; resourceName: string; region: string }[];
    estimatedSavings: number;
    reasoning: string;
  } | null>(null);
  const [planningRec, setPlanningRec] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);

  useEffect(() => {
    if (!cacheKey) return;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const data: CachedData = JSON.parse(cached);
        if (data.version !== CACHE_VERSION) {
          sessionStorage.removeItem(cacheKey);
          return;
        }
        setInsights(data.insights);
        setMetrics(data.metrics);
        setDismissed(data.dismissed || []);
        setLastUpdated(data.timestamp);
      } else {
        setInsights(null);
        setMetrics(null);
        setDismissed([]);
        setLastUpdated(null);
      }
    } catch (e) {
      console.error("Failed to load cached multicloud insights:", e);
    }
  }, [cacheKey]);

  const saveToCache = useCallback(
    (newInsights: Insights, newMetrics: Metrics, newDismissed: string[]) => {
      if (!cacheKey) return;
      try {
        const data: CachedData = {
          insights: newInsights,
          metrics: newMetrics,
          timestamp: new Date().toLocaleString(),
          dismissed: newDismissed,
          version: CACHE_VERSION,
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        setLastUpdated(data.timestamp);
      } catch (e) {
        console.error("Failed to cache multicloud insights:", e);
      }
    },
    [cacheKey],
  );

  const handleRefresh = useCallback(async () => {
    setSyncInProgress(false);
    setLoading(true);
    setError(null);

    try {
      const data = await getCloudRecommendations({
        provider: "all",
        region: "all",
        forceRefresh: true,
      });
      const nextInsights: Insights = {
        recommendations: (data.insights?.recommendations || []).map(normalizeRecommendation),
        diagnosis: data.insights?.diagnosis || [],
        optimizations: data.insights?.optimizations || [],
        warnings: data.insights?.warnings || data.warnings || [],
        providers: data.providers,
      };

      const nextMetrics: Metrics = {
        resources: data.metrics?.resources || [],
        billing: data.metrics?.billing || [],
        security: data.metrics?.security || [],
      };

      setInsights(nextInsights);
      setMetrics(nextMetrics);
      setDismissed([]);
      saveToCache(nextInsights, nextMetrics, []);
      if (data.syncInProgress) {
        setSyncInProgress(true);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(
        err instanceof ApiClientError
          ? err.message
          : err?.message || "Failed to load multicloud insights",
      );
      console.error("Multicloud recommendations error:", err);
    } finally {
      setLoading(false);
    }
  }, [saveToCache]);

  // Poll in the background if background sync is in progress
  useEffect(() => {
    if (!syncInProgress) return;

    let timer: NodeJS.Timeout | null = null;
    let isAborted = false;

    const poll = async () => {
      try {
        const data = await getCloudRecommendations({
          provider: "all",
          region: "all",
          forceRefresh: false,
        });

        if (isAborted) return;

        const nextInsights: Insights = {
          recommendations: (data.insights?.recommendations || []).map(normalizeRecommendation),
          diagnosis: data.insights?.diagnosis || [],
          optimizations: data.insights?.optimizations || [],
          warnings: data.insights?.warnings || data.warnings || [],
          providers: data.providers,
        };

        const nextMetrics: Metrics = {
          resources: data.metrics?.resources || [],
          billing: data.metrics?.billing || [],
          security: data.metrics?.security || [],
        };

        setInsights(nextInsights);
        setMetrics(nextMetrics);
        saveToCache(nextInsights, nextMetrics, dismissed);

        if (!data.syncInProgress) {
          setSyncInProgress(false);
        } else {
          timer = setTimeout(poll, 4000);
        }
      } catch (err) {
        console.error("Error polling multicloud insights:", err);
        if (!isAborted) {
          timer = setTimeout(poll, 4000);
        }
      }
    };

    timer = setTimeout(poll, 4000);

    return () => {
      isAborted = true;
      if (timer) clearTimeout(timer);
    };
  }, [syncInProgress, dismissed, saveToCache]);

  useEffect(() => {
    if (!insights) return;
    const onActionExecution = () => { handleRefresh(); };
    window.addEventListener(ACTION_EXECUTION_EVENT, onActionExecution);
    return () => window.removeEventListener(ACTION_EXECUTION_EVENT, onActionExecution);
  }, [handleRefresh, insights]);

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissed, id];
    setDismissed(newDismissed);
    if (insights && metrics) {
      saveToCache(insights, metrics, newDismissed);
    }
  };

  const handleRestoreDismissed = (id: string) => {
    const newDismissed = dismissed.filter((item) => item !== id);
    setDismissed(newDismissed);
    if (insights && metrics) {
      saveToCache(insights, metrics, newDismissed);
    }
  };

  const handleImplementPlan = async (rec: Recommendation) => {
    if (rec.provider !== "aws") {
      setError(
        `${getProviderCopy(rec.provider).shortLabel} recommendations are advisory today. Review them in the provider console until automated actions are enabled.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setPlanningRec(rec.id);
    try {
      if (rec.actionPlan) {
        const plan = rec.actionPlan;
        const { nodes, edges } = buildSimulationDraftFromRecommendation(rec, plan);
        const simRes = await authFetch("/api/simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Plan: ${rec.title}`,
            region: plan.targets[0]?.region || "us-east-1",
            nodes,
            edges,
          }),
        });

        const simData = await simRes.json();
        if (simData.success && simData.simulation) {
          window.location.href = `/simulation?id=${simData.simulation._id}`;
          return;
        }
        setError("Failed to create simulation plan from the recommendation.");
        return;
      }

      const response = await authFetch("/api/aws/actions/plan-from-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation: {
            title: rec.title, description: rec.description,
            action: rec.action, savings: rec.savings,
          },
          factSheet: "",
        }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(`Failed to plan action: ${data.error}`);
        return;
      }
      if (data.plans.length === 0) {
        setError("The AI could not generate an automated plan. Manual intervention required.");
        return;
      }

      if (data.success && data.plans.length > 0) {
        const plan = data.plans[0];
        const { nodes, edges } = buildSimulationDraftFromRecommendation(rec, plan);
        const simRes = await authFetch("/api/simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Plan: ${rec.title}`,
            region: plan.targets[0]?.region || "us-east-1",
            nodes,
            edges,
          }),
        });
        const simData = await simRes.json();
        if (simData.success && simData.simulation) {
          window.location.href = `/simulation?id=${simData.simulation._id}`;
          return;
        }
      }
    } catch (err) {
      console.error("Implement plan failed:", err);
      setError("An error occurred while generating the plan.");
    } finally {
      setPlanningRec(null);
    }
  };

  const handlePlanAction = async (rec: Recommendation) => {
    if (rec.provider !== "aws") {
      setError(
        `${getProviderCopy(rec.provider).shortLabel} action planning is not automated yet. Use the provider recommendation details and review it in ${rec.provider === "azure" ? "Azure Advisor" : "Google Cloud Recommender"}.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setPlanningRec(rec.id);
    try {
      if (rec.actionPlan) {
        setSelectedAction({
          actionId: rec.actionPlan.actionId,
          targets: rec.actionPlan.targets,
          estimatedSavings: rec.actionPlan.estimatedSavings,
          reasoning: rec.actionPlan.reasoning,
        });
        setActionDrawerOpen(true);
        return;
      }

      const response = await authFetch("/api/aws/actions/plan-from-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation: {
            title: rec.title, description: rec.description,
            action: rec.action, savings: rec.savings,
          },
          factSheet: "",
        }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(`Failed to plan action: ${data.error}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (data.plans.length === 0) {
        setError(`Manual Action Required: The AI could not generate an automated plan for "${rec.title}".`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (data.success && data.plans.length > 0) {
        const plan = data.plans[0];
        setSelectedAction({
          actionId: plan.actionId,
          targets: plan.targets,
          estimatedSavings: plan.estimatedSavings,
          reasoning: plan.reasoning,
        });
        setActionDrawerOpen(true);
      }
    } catch (err) {
      setError("An error occurred while generating the plan.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPlanningRec(null);
    }
  };

  const visibleRecommendations = useMemo(
    () => insights?.recommendations?.filter((r) => !dismissed.includes(r.id))
      .filter((r) => providerFilter === "all" || r.provider === providerFilter) || [],
    [dismissed, insights?.recommendations, providerFilter],
  );

  const dismissedRecommendations = useMemo(
    () => insights?.recommendations?.filter((r) => dismissed.includes(r.id))
      .filter((r) => providerFilter === "all" || r.provider === providerFilter) || [],
    [dismissed, insights?.recommendations, providerFilter],
  );

  const visibleOptimizations = useMemo(
    () => insights?.optimizations?.filter((item) => providerFilter === "all" || item.provider === providerFilter) || [],
    [insights?.optimizations, providerFilter],
  );

  const visibleDiagnosis = useMemo(
    () => insights?.diagnosis?.filter((item) => providerFilter === "all" || item.provider === providerFilter) || [],
    [insights?.diagnosis, providerFilter],
  );

  const connectedProviders = useMemo(
    () => PROVIDERS.filter((p) => insights?.providers?.[p]?.connected),
    [insights?.providers],
  );

  const disconnectedProviders = useMemo(
    () => PROVIDERS.filter((p) => insights?.providers && !insights.providers[p]?.connected),
    [insights?.providers],
  );

  const parseCurrencySavings = (s?: string): number => {
    if (!s || !s.includes("$")) return 0;
    const match = s.match(/\$([\d,.]+)/);
    return match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
  };

  const totalCurrencySavings = [
    ...visibleRecommendations,
    ...visibleOptimizations,
  ].reduce((acc, item: any) => acc + parseCurrencySavings(item.savings), 0);

  const totalSpend = (metrics?.billing || [])
    .filter((item) => providerFilter === "all" || item.provider === providerFilter)
    .reduce((sum, item) => sum + Number(item.mtdSpend ?? item.currentSpend ?? 0), 0);

  const spendUnit = (metrics?.billing || []).find(
    (item) => providerFilter === "all" || item.provider === providerFilter,
  )?.unit || "USD";

  const resourceCount = (metrics?.resources || []).filter(
    (item) => providerFilter === "all" || item.provider === providerFilter,
  ).length;

  const findingCount = (metrics?.security || [])
    .filter((item) => providerFilter === "all" || item.provider === providerFilter)
    .reduce((sum, item) => sum + Number(item.findingsCount || 0), 0);

  return {
    insights, metrics, error, setError, dismissed, lastUpdated, providerFilter,
    setProviderFilter, actionDrawerOpen, setActionDrawerOpen, selectedAction,
    setSelectedAction, planningRec, loading, handleRefresh, handleDismiss,
    handleRestoreDismissed, handleImplementPlan, handlePlanAction,
    visibleRecommendations, dismissedRecommendations, visibleOptimizations,
    visibleDiagnosis, connectedProviders, disconnectedProviders,
    totalCurrencySavings, totalSpend, spendUnit, resourceCount, findingCount,
    PROVIDERS, syncInProgress,
  };
}
