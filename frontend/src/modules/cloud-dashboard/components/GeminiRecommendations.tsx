import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionPreviewDrawer } from "@/components/ActionPreviewDrawer";
import { RefreshCw, Loader2, X, ChevronRight, Zap, Sparkles } from "@/icons";
import { useGeminiRecommendations, Recommendation } from "../hooks/useGeminiRecommendations";
import { MetricsSummary } from "./Recommendations/MetricsSummary";
import { DiagnosisList } from "./Recommendations/DiagnosisList";
import { OptimizationsList } from "./Recommendations/OptimizationsList";

const impactTone: Record<Recommendation["impact"], string> = {
    high: "border-l-red-500 bg-red-50/40 dark:bg-red-950/20 dark:border-l-red-600",
    medium: "border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20 dark:border-l-amber-600",
    low: "border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-l-emerald-600",
};

const parseSavings = (s?: string): number => {
    if (!s) return 0;
    const match = s.match(/\$?([\d,.]+)/);
    return match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
};

export function GeminiRecommendations() {
    const {
        insights, metrics, error, dismissed, lastUpdated, source,
        actionDrawerOpen, setActionDrawerOpen, selectedAction, setSelectedAction,
        planningRec, loading, handleRefresh, handleDismiss, handlePlanAction,
    } = useGeminiRecommendations();

    const activeRecommendations =
        insights?.recommendations?.filter((r) => !dismissed.includes(r.id)) || [];

    const totalSavings = [
        ...activeRecommendations,
        ...(insights?.optimizations || [])
    ].reduce((acc, item) => acc + parseSavings(item.savings), 0);

    return (
        <div className="flex min-h-[calc(100vh-10rem)] gap-4 items-stretch">
            {/* Main Content */}
            <div className="flex-1 space-y-5">
                {/* Header */}
                <div className="mb-4 flex items-start justify-between pb-4 border-b border-border">
                    <div>
                        <h1 className="text-xl font-semibold text-foreground tracking-tight">
                            Recommendations Hub
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {loading
                                ? "Analyzing infrastructure..."
                                : "Cost and reliability recommendations for your AWS estate"}
                            {source && !loading && (
                                <span className="ml-2 inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                                    {source === "gemini" ? "AI" : "Rules"} analyzed
                                </span>
                            )}
                            {lastUpdated && (
                                <span className="text-muted-foreground/60"> &middot; Updated {lastUpdated}</span>
                            )}
                        </p>
                    </div>
                    <Button onClick={handleRefresh} disabled={loading} size="sm" className="text-xs">
                        {loading ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {loading && insights ? "Refreshing..." : insights ? "Refresh" : "Analyze"}
                    </Button>
                </div>

                {/* Error */}
                {error && (
                    <Card className="p-3 mb-4 bg-destructive/10 border-destructive/20 text-destructive text-sm">
                        {error}
                    </Card>
                )}

                {/* Loading */}
                {loading && !insights && (
                    <div className="flex items-center justify-center py-24 gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing infrastructure...
                    </div>
                )}

                {/* Initial State */}
                {!insights && !loading && !error && (
                    <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border rounded-lg bg-white dark:bg-[#07111F]">
                        <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
                            <Sparkles className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <h2 className="text-base font-medium text-foreground mb-1">Generate Intelligence</h2>
                        <p className="text-muted-foreground text-sm max-w-sm text-center mb-4">
                            Analyze your AWS environment to uncover cost savings and infrastructure anomalies.
                        </p>
                        <Button onClick={handleRefresh} size="sm">
                            <Zap className="w-3.5 h-3.5 mr-1.5" />
                            Run Analysis
                        </Button>
                    </div>
                )}

                {/* Results */}
                {insights && (
                    <div className="space-y-6">
                        {metrics && <MetricsSummary metrics={metrics} totalSavings={totalSavings} />}
                        <DiagnosisList diagnosis={insights.diagnosis} />

                        {/* Recommendations */}
                        <div>
                            <h2 className="text-sm font-medium text-foreground mb-3">Recommendations</h2>
                            <div className="space-y-2">
                                <AnimatePresence>
                                    {activeRecommendations.map((rec) => (
                                        <motion.div
                                            key={rec.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                        >
                                            <Card className={`p-4 border-l-4 ${impactTone[rec.impact]} hover:bg-secondary/30 transition-colors bg-white dark:bg-[#07111F]`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <h3 className="text-sm font-medium text-foreground">{rec.title}</h3>
                                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{rec.impact}</Badge>
                                                            {rec.savings && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-[#0B1E19] dark:text-emerald-400 dark:border-emerald-950"
                                                                >
                                                                    Save {rec.savings}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mb-2">{rec.description}</p>
                                                        <div className="flex items-center gap-3">
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <ChevronRight className="w-3 h-3" />
                                                                {rec.action}
                                                            </p>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handlePlanAction(rec)}
                                                                disabled={planningRec === rec.id}
                                                                className="h-7 text-xs"
                                                            >
                                                                {planningRec === rec.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Zap className="w-3.5 h-3.5 mr-1" />
                                                                )}
                                                                Plan Action
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDismiss(rec.id)}
                                                        aria-label="Dismiss recommendation"
                                                        className="text-muted-foreground/40 hover:text-muted-foreground h-8 w-8"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                {activeRecommendations.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        No pending recommendations
                                    </p>
                                )}
                            </div>
                        </div>

                        <OptimizationsList optimizations={insights.optimizations} />
                    </div>
                )}
            </div>

            {/* Action Preview Drawer */}
            {selectedAction && (
                <ActionPreviewDrawer
                    isOpen={actionDrawerOpen}
                    onClose={() => { setActionDrawerOpen(false); setSelectedAction(null); }}
                    actionId={selectedAction.actionId}
                    targets={selectedAction.targets}
                    estimatedSavings={selectedAction.estimatedSavings}
                    reasoning={selectedAction.reasoning}
                    onActionComplete={() => {
                        setActionDrawerOpen(false);
                        setSelectedAction(null);
                        handleRefresh();
                    }}
                />
            )}
        </div>
    );
}
