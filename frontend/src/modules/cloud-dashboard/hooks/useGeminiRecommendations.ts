import { useState, useCallback, useEffect } from "react";
import { authFetch, ApiClientError } from "@/lib/auth-fetch";
import { ACTION_EXECUTION_EVENT } from "@/lib/action-events";

export interface Recommendation {
    id: string;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    category: string;
    savings?: string;
    action: string;
}

export interface Diagnosis {
    title: string;
    status: "healthy" | "warning" | "critical";
    details: string;
}

export interface Optimization {
    id: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
    savings?: string;
    action: string;
}

export interface Insights {
    recommendations: Recommendation[];
    diagnosis: Diagnosis[];
    optimizations: Optimization[];
}

export interface Metrics {
    ec2_cpu?: { current: number; avg: number; max: number; min: number; trend: string };
    billing?: { mtd?: { total: number; unit: string }; forecast?: { amount: number; unit: string } | null };
    inventory?: { counts: { ec2: number; lambda: number; rds: number; s3: number; total: number } };
    [key: string]: unknown;
}

export interface CachedData {
    insights: Insights;
    metrics: Metrics;
    timestamp: string;
    dismissed: string[];
    source?: "rules" | "gemini";
}

const CACHE_KEY = "rabbittize_insights";

export function useGeminiRecommendations() {
    const [insights, setInsights] = useState<Insights | null>(null);
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState<string[]>([]);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [source, setSource] = useState<"rules" | "gemini" | null>(null);
    const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState<{
        actionId: string;
        targets: { resourceId: string; resourceName: string; region: string }[];
        estimatedSavings: number;
        reasoning: string;
    } | null>(null);
    const [planningRec, setPlanningRec] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Load cached data on mount
    useEffect(() => {
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const data: CachedData = JSON.parse(cached);
                setInsights(data.insights);
                setMetrics(data.metrics);
                setDismissed(data.dismissed || []);
                setLastUpdated(data.timestamp);
                setSource(data.source || null);
            }
        } catch (e) {
            console.error("Failed to load cached insights:", e);
        }
    }, []);

    // Save to cache whenever insights change
    const saveToCache = useCallback((newInsights: Insights, newMetrics: Metrics, newDismissed: string[], newSource?: "rules" | "gemini") => {
        try {
            const data: CachedData = {
                insights: newInsights,
                metrics: newMetrics,
                timestamp: new Date().toLocaleString(),
                dismissed: newDismissed,
                source: newSource,
            };
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
            setLastUpdated(data.timestamp);
        } catch (e) {
            console.error("Failed to cache insights:", e);
        }
    }, []);

    const handleRefresh = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await authFetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();

            setInsights(data.insights);
            setMetrics(data.metrics);
            setSource(data.source || "rules");
            setDismissed([]);
            saveToCache(data.insights, data.metrics, [], data.source);
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") return;
            if (err instanceof ApiClientError) {
                setError(err.message);
            } else if (err instanceof Error) {
                setError(err.message || "Failed to connect to AI service");
            } else {
                setError("Failed to connect to AI service");
            }
            console.error("AI analysis error:", err);
        } finally {
            setLoading(false);
        }
    }, [saveToCache]);

    useEffect(() => {
        if (!insights) return;

        const onActionExecution = () => {
            handleRefresh();
        };

        window.addEventListener(ACTION_EXECUTION_EVENT, onActionExecution);
        return () => window.removeEventListener(ACTION_EXECUTION_EVENT, onActionExecution);
    }, [handleRefresh, insights]);

    const handleDismiss = useCallback((id: string) => {
        setDismissed((prev) => {
            const next = [...prev, id];
            if (insights && metrics) {
                saveToCache(insights, metrics, next, source || undefined);
            }
            return next;
        });
    }, [insights, metrics, saveToCache, source]);

    const handlePlanAction = useCallback(async (rec: Recommendation) => {
        setPlanningRec(rec.id);
        try {
            const response = await authFetch("/api/actions/plan-from-recommendation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recommendation: {
                        title: rec.title,
                        description: rec.description,
                        action: rec.action,
                        savings: rec.savings,
                    },
                    factSheet: "",
                }),
            });
            const data = await response.json();
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
            console.error("Plan action failed:", err);
        } finally {
            setPlanningRec(null);
        }
    }, []);

    return {
        insights,
        metrics,
        error,
        dismissed,
        lastUpdated,
        source,
        actionDrawerOpen,
        setActionDrawerOpen,
        selectedAction,
        setSelectedAction,
        planningRec,
        loading,
        handleRefresh,
        handleDismiss,
        handlePlanAction,
    };
}
