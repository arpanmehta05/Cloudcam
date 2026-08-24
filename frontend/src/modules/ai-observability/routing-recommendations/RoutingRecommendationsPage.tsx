"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, ArrowRight, DollarSign, RefreshCw, Lightbulb, Hash } from "@/icons";
import { Button } from "@/components/ui/button";
import { useRoutingRecommendations } from "./hooks/useRoutingRecommendations";

function formatCost(val: number): string {
    if (val >= 1) return `$${val.toFixed(2)}`;
    if (val > 0) return `$${val.toFixed(4)}`;
    return "$0.00";
}

const RULE_LABELS: Record<string, string> = {
    short_responses: "Short responses on expensive model",
    simple_prompts: "Simple prompts on expensive model",
    high_volume_expensive: "High volume on expensive model",
    cost_ratio: "Cost per token > 2x cheapest",
};

export default function RoutingRecommendationsPage() {
    const { loading, data, lastUpdated, refresh } = useRoutingRecommendations();

    const totalEndpoints = data?.recommendations.length ?? 0;
    const totalRequests = data?.recommendations.reduce((s, r) => s + r.requestsAffected, 0) ?? 0;

    return (
        <div>
            <header className="flex items-center justify-between pb-4 border-b border-border mb-5">
                <div className="flex items-center gap-3">
                    <TrendingDown className="w-5 h-5 text-green-400" />
                    <div>
                        <h1 className="text-lg font-display font-bold tracking-tight">Model Routing Recommendations</h1>
                        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                            Cheaper models for endpoints that don&apos;t need expensive ones
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
                            <DollarSign className="w-4 h-4 text-green-400" />
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Monthly Savings</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-9 w-32 mt-1" />
                        ) : (
                            <p className="text-3xl font-semibold text-green-400">{formatCost(data?.totalMonthlySavings ?? 0)}</p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Endpoints Affected</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-9 w-16 mt-1" />
                        ) : (
                            <p className="text-3xl font-semibold">{totalEndpoints}</p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Hash className="w-4 h-4 text-blue-400" />
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Requests Affected</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-9 w-24 mt-1" />
                        ) : (
                            <p className="text-3xl font-semibold">{totalRequests.toLocaleString()}</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recommendations Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Recommendations</CardTitle>
                    <CardDescription className="text-xs">
                        Sorted by estimated monthly savings (highest first)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                        </div>
                    ) : !data || data.recommendations.length === 0 ? (
                        <div className="text-center py-16">
                            <Lightbulb className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No routing recommendations yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-2 max-w-md mx-auto">
                                Recommendations appear after request data is collected. The system analyzes patterns over the last 7 days to find endpoints using expensive models where a cheaper alternative would work.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Endpoint</th>
                                        <th className="text-left py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Current</th>
                                        <th className="text-left py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Suggested</th>
                                        <th className="text-left py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Provider</th>
                                        <th className="text-right py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Requests</th>
                                        <th className="text-right py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Avg Prompt</th>
                                        <th className="text-right py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Avg Completion</th>
                                        <th className="text-right py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Confidence</th>
                                        <th className="text-right py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Rule</th>
                                        <th className="text-right py-3 px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Savings/mo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recommendations.map((rec, i) => (
                                        <tr key={i} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                                            <td className="py-3 px-2">
                                                <Badge variant="outline" className="text-[10px] font-mono">{rec.endpoint || "unknown"}</Badge>
                                            </td>
                                            <td className="py-3 px-2 font-mono text-foreground">{rec.currentModel}</td>
                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-1">
                                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                                    <span className="font-mono text-green-400">{rec.suggestedModel}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <Badge variant="outline" className="text-[9px] uppercase">{rec.provider}</Badge>
                                            </td>
                                            <td className="text-right py-3 px-2 text-muted-foreground">{rec.requestsAffected.toLocaleString()}</td>
                                            <td className="text-right py-3 px-2 text-muted-foreground">{rec.avgPromptTokens.toLocaleString()}</td>
                                            <td className="text-right py-3 px-2 text-muted-foreground">{rec.avgCompletionTokens.toLocaleString()}</td>
                                            <td className="text-right py-3 px-2">
                                                <Badge
                                                    variant={rec.confidence >= 0.8 ? "default" : rec.confidence >= 0.6 ? "secondary" : "outline"}
                                                    className="text-[9px] px-1.5 py-0"
                                                >
                                                    {Math.round(rec.confidence * 100)}%
                                                </Badge>
                                            </td>
                                            <td className="text-right py-3 px-2 text-muted-foreground text-[10px]">{RULE_LABELS[rec.ruleTriggered] ?? rec.ruleTriggered}</td>
                                            <td className="text-right py-3 px-2 font-semibold text-green-400">{formatCost(rec.monthlySavings)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
