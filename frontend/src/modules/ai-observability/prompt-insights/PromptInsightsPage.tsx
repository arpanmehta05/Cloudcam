"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Hash, RefreshCw, DollarSign, AlertCircle, Layers } from "@/icons";
import { Button } from "@/components/ui/button";
import { usePromptInsights } from "./hooks/usePromptInsights";

function formatCost(val: number): string {
    if (val >= 1) return `$${val.toFixed(2)}`;
    if (val > 0) return `$${val.toFixed(4)}`;
    return "$0.00";
}

function formatTokens(val: number): string {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return String(val);
}

const INSIGHT_LABELS: Record<string, string> = {
    fixed_prompt: "Fixed System Prompt",
    prompt_completion_imbalance: "Prompt:Completion Imbalance",
    duplicate_context: "Duplicate Context",
};

const INSIGHT_ICONS: Record<string, typeof AlertCircle> = {
    fixed_prompt: Hash,
    prompt_completion_imbalance: AlertCircle,
    duplicate_context: Layers,
};

export default function PromptInsightsPage() {
    const { loading, insights, lastUpdated, refresh } = usePromptInsights();

    const totalTokenSavings = insights.reduce((s, i) => s + i.estimatedTokenSavings, 0);
    const totalCostSavings = insights.reduce((s, i) => s + i.estimatedCostSavings, 0);

    return (
        <div>
            <header className="flex items-center justify-between pb-4 border-b border-border mb-5">
                <div className="flex items-center gap-3">
                    <Hash className="w-5 h-5 text-blue-400" />
                    <div>
                        <h1 className="text-lg font-display font-bold tracking-tight">Prompt Compression Insights</h1>
                        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                            Unnecessarily large prompts wasting tokens and cost
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-[11px] font-mono text-muted-foreground">Updated: {lastUpdated}</span>
                    )}
                    <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="h-8 text-xs font-mono gap-1.5">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Hash className="w-4 h-4 text-blue-400" />
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Token Savings/Day</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-9 w-24 mt-1" />
                        ) : (
                            <p className="text-3xl font-semibold text-blue-400">{formatTokens(totalTokenSavings)}</p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-green-400" />
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Cost Savings/Mo</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-9 w-24 mt-1" />
                        ) : (
                            <p className="text-3xl font-semibold text-green-400">{formatCost(totalCostSavings)}</p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Insights Found</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-9 w-16 mt-1" />
                        ) : (
                            <p className="text-3xl font-semibold">{insights.length}</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Insights List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Prompt Insights</CardTitle>
                    <CardDescription className="text-xs">
                        Endpoints with opportunities for prompt optimization
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                        </div>
                    ) : insights.length === 0 ? (
                        <div className="text-center py-16">
                            <Hash className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No prompt compression opportunities detected</p>
                            <p className="text-xs text-muted-foreground/60 mt-2 max-w-md mx-auto">
                                Insights appear after request data is collected. The system analyzes prompt sizes, response ratios, and duplicate context patterns across endpoints.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {insights.map((insight, i) => {
                                const Icon = INSIGHT_ICONS[insight.insightType] || AlertCircle;
                                return (
                                    <div key={i} className="border border-border p-4 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <Icon className="w-4 h-4 text-blue-400" />
                                                <div>
                                                    <Badge variant="outline" className="text-[10px] font-mono mr-2">{insight.endpoint || "unknown"}</Badge>
                                                    {insight.serviceName && (
                                                        <Badge variant="secondary" className="text-[10px] font-mono">{insight.serviceName}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Badge
                                                variant={insight.insightType === "fixed_prompt" ? "default" : insight.insightType === "prompt_completion_imbalance" ? "secondary" : "outline"}
                                                className="text-[9px] px-1.5 py-0"
                                            >
                                                {INSIGHT_LABELS[insight.insightType] ?? insight.insightType}
                                            </Badge>
                                        </div>

                                        <p className="text-xs text-muted-foreground mb-3">{insight.message}</p>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div>
                                                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-widest">Avg Prompt</p>
                                                <p className="text-sm font-semibold mt-0.5">{insight.avgPromptTokens.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-widest">Avg Completion</p>
                                                <p className="text-sm font-semibold mt-0.5">{insight.avgCompletionTokens.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-widest">Prompt Ratio</p>
                                                <p className="text-sm font-semibold mt-0.5">{insight.promptRatio.toFixed(1)}:1</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-widest">Token Savings</p>
                                                <p className="text-sm font-semibold mt-0.5 text-blue-400">{formatTokens(insight.estimatedTokenSavings)}/day</p>
                                            </div>
                                        </div>

                                        {insight.estimatedCostSavings > 0 && (
                                            <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
                                                <DollarSign className="w-3 h-3" />
                                                <span>Estimated {formatCost(insight.estimatedCostSavings)}/month savings</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
