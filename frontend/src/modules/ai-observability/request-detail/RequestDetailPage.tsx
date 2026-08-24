"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, Copy, Cpu, DollarSign, Download, Hash, Layers } from "@/icons";
import { exportJSON } from "@/lib/exporters";
import { getRequest, type AiRequestTrace } from "./api";

function formatCost(val: number): string {
    if (val >= 1) return `$${val.toFixed(2)}`;
    if (val > 0) return `$${val.toFixed(6)}`;
    return "$0.00";
}

function statusBadgeVariant(status: string): "destructive" | "secondary" | "outline" | "default" {
    switch (status) {
        case "success": return "default";
        case "error": return "destructive";
        case "rate_limited": return "secondary";
        case "timeout": return "secondary";
        default: return "outline";
    }
}

function KpiBox({ label, value, icon: Icon, color = "text-primary" }: {
    label: string; value: string; icon?: React.ElementType; color?: string;
}) {
    return (
        <div className="border border-border p-3 bg-secondary/10 group hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">{label}</p>
                {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
            </div>
            <p className="text-sm font-semibold truncate">{value}</p>
        </div>
    );
}

export default function RequestDetailPage({ id }: { id: string }) {
    const [loading, setLoading] = useState(true);
    const [trace, setTrace] = useState<AiRequestTrace | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const fetchTrace = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getRequest(id);
            setTrace(data);
        } catch (err: any) {
            setError(err?.message || "Failed to load request trace");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchTrace(); }, [fetchTrace]);

    async function copyRequestId() {
        if (!trace) return;
        await navigator.clipboard.writeText(trace.requestId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleExport() {
        if (!trace) return;
        exportJSON(trace, `request-${trace.requestId}.json`);
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-24 w-full" />
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
                </div>
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    if (error || !trace) {
        return (
            <div className="space-y-4">
                <Link href="/ai-observability/errors">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
                        <ArrowLeft className="w-3.5 h-3.5" />Back to Errors
                    </Button>
                </Link>
                <Card>
                    <CardContent className="pt-6 text-center py-16">
                        <p className="text-sm text-red-400 mb-3">{error || "Request trace not found."}</p>
                        <Button variant="outline" size="sm" onClick={fetchTrace} className="text-xs font-mono">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const totalTokens = trace.totalTokens || (trace.promptTokens + trace.completionTokens);
    const promptPct = totalTokens > 0 ? (trace.promptTokens / totalTokens) * 100 : 50;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Link href="/ai-observability/errors">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
                        <ArrowLeft className="w-3.5 h-3.5" />Back
                    </Button>
                </Link>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={copyRequestId} className="gap-1 text-xs font-mono">
                        <Copy className="w-3 h-3" />{copied ? "Copied!" : "Copy ID"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 text-xs font-mono">
                        <Download className="w-3 h-3" />Export JSON
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="pt-5">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-base font-display font-bold">Request Trace</h1>
                                <Badge variant={statusBadgeVariant(trace.status)} className="text-[9px]">{trace.status}</Badge>
                            </div>
                            <p className="text-xs font-mono text-muted-foreground">{trace.requestId}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">{trace.provider}</Badge>
                            <Badge variant="outline" className="text-[10px] font-mono">{trace.modelName}</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KpiBox label="Provider" value={trace.provider.toUpperCase()} icon={Layers} />
                <KpiBox label="Model" value={trace.modelName} icon={Cpu} />
                <KpiBox label="Latency" value={`${trace.latencyMs}ms`} icon={Clock} />
                <KpiBox label="Total Tokens" value={totalTokens.toLocaleString()} icon={Hash} />
                <KpiBox label="Cost" value={formatCost(trace.cost)} icon={DollarSign} color="text-green-400" />
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Token Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="h-5 flex overflow-hidden border border-border">
                        <div className="bg-[var(--chart-1)] transition-all flex items-center justify-center" style={{ width: `${promptPct}%` }}>
                            {promptPct > 15 && <span className="text-[9px] font-mono text-primary-foreground">{trace.promptTokens.toLocaleString()}</span>}
                        </div>
                        <div className="bg-[var(--chart-2)] transition-all flex items-center justify-center" style={{ width: `${100 - promptPct}%` }}>
                            {(100 - promptPct) > 15 && <span className="text-[9px] font-mono text-primary-foreground">{trace.completionTokens.toLocaleString()}</span>}
                        </div>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground">Prompt: {trace.promptTokens.toLocaleString()} ({promptPct.toFixed(1)}%)</span>
                        <span className="text-[10px] font-mono text-muted-foreground">Completion: {trace.completionTokens.toLocaleString()} ({(100 - promptPct).toFixed(1)}%)</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="border border-border p-3 bg-secondary/10">
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Prompt</p>
                            <p className="text-lg font-semibold mt-1">{trace.promptTokens.toLocaleString()}</p>
                        </div>
                        <div className="border border-border p-3 bg-secondary/10">
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Completion</p>
                            <p className="text-lg font-semibold mt-1">{trace.completionTokens.toLocaleString()}</p>
                        </div>
                        <div className="border border-border p-3 bg-secondary/10">
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Total</p>
                            <p className="text-lg font-semibold mt-1">{totalTokens.toLocaleString()}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {trace.errorMessage && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-red-400">Error Message</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-secondary/30 border border-border p-4 text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto font-mono">
                            {trace.errorMessage}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {trace.metadata && Object.keys(trace.metadata).length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Metadata</CardTitle>
                        <CardDescription className="text-xs">Context captured during the request</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-secondary/30 border border-border p-4 text-xs whitespace-pre-wrap break-words max-h-96 overflow-auto font-mono">
                            {JSON.stringify(trace.metadata, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Timestamps</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Created</p>
                            <p className="text-xs text-foreground mt-1">{new Date(trace.createdAt).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Updated</p>
                            <p className="text-xs text-foreground mt-1">{new Date(trace.updatedAt).toLocaleString()}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
