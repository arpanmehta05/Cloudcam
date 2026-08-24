"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegion } from "@/context/RegionContext";
import {
    aiObservabilityApi,
    type BedrockConsoleMetrics,
    type BedrockWindow,
} from "../../api/ai-observability.api";
import { RefreshCw, Cpu, Timer, ShieldAlert, Activity } from "@/icons";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    Tooltip,
    XAxis,
    YAxis,
    LineChart,
    Line,
    CartesianGrid,
} from "recharts";

function formatTokens(val: number): string {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return String(val);
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    if (status === "success") return "default";
    if (status === "rate_limited" || status === "timeout") return "secondary";
    if (status === "error") return "destructive";
    return "outline";
}

function KpiMini({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
    return (
        <div className="border border-border p-3 bg-secondary/10">
            <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">{label}</p>
            <p className="text-lg font-semibold mt-1">{value}</p>
            {subtitle ? <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p> : null}
        </div>
    );
}

const WINDOWS: BedrockWindow[] = ["30m", "3h", "12h", "24h"];

interface BedrockConsoleProps {
    preferredWindow?: BedrockWindow;
    onMetricsChange?: (metrics: BedrockConsoleMetrics | null) => void;
}

export function BedrockConsole({ preferredWindow, onMetricsChange }: BedrockConsoleProps) {
    const { selectedRegion } = useRegion();
    const [window, setWindow] = useState<BedrockWindow>(preferredWindow || "12h");
    const [modelInput, setModelInput] = useState("");
    const [modelFilter, setModelFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [metrics, setMetrics] = useState<BedrockConsoleMetrics | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resolvedRegion = selectedRegion === "all" ? "us-east-1" : selectedRegion;

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await aiObservabilityApi.getBedrockConsoleMetrics({
                window,
                region: resolvedRegion,
                modelId: modelFilter || undefined,
                limit: 50,
            });
            setMetrics(data);
            onMetricsChange?.(data);
        } catch (err: any) {
            setError(err?.message || "Failed to load Bedrock console metrics");
            setMetrics(null);
            onMetricsChange?.(null);
        } finally {
            setLoading(false);
        }
    }, [window, resolvedRegion, modelFilter, onMetricsChange]);

    const handleSync = useCallback(async () => {
        setSyncing(true);
        setError(null);
        try {
            await aiObservabilityApi.syncBedrockMetrics({ region: resolvedRegion, daysBack: 7 });
            await fetchMetrics();
        } catch (err: any) {
            setError(err?.message || "Failed to sync Bedrock metrics");
        } finally {
            setSyncing(false);
        }
    }, [resolvedRegion, fetchMetrics]);

    useEffect(() => {
        void fetchMetrics();
    }, [fetchMetrics]);

    useEffect(() => {
        if (preferredWindow && preferredWindow !== window) {
            setWindow(preferredWindow);
        }
    }, [preferredWindow, window]);

    const reliabilityChart = useMemo(() => {
        if (!metrics) return [];
        return metrics.series.reliability.map((p) => ({
            ...p,
            label: new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
    }, [metrics]);

    const distributionChart = useMemo(() => {
        if (!metrics) return [];
        return metrics.series.requestDistribution.map((row) => ({
            bucket: row.bucket,
            count: row.count,
        }));
    }, [metrics]);

    const authModeStats = useMemo(() => {
        if (!metrics || metrics.authModes.length === 0) {
            return {
                total: 0,
                shortTermRequests: 0,
                longTermRequests: 0,
                unknownRequests: 0,
            };
        }
        const total = metrics.authModes.reduce((acc, row) => acc + row.requests, 0);
        const shortTermRequests = metrics.authModes
            .filter((row) => row.mode === "short_term")
            .reduce((acc, row) => acc + row.requests, 0);
        const longTermRequests = metrics.authModes
            .filter((row) => row.mode === "long_term")
            .reduce((acc, row) => acc + row.requests, 0);
        const unknownRequests = Math.max(total - shortTermRequests - longTermRequests, 0);
        return { total, shortTermRequests, longTermRequests, unknownRequests };
    }, [metrics]);

    const errorBuckets = useMemo(() => {
        if (!metrics) return [];
        return metrics.series.reliability
            .map((point) => ({
                timestamp: point.timestamp,
                label: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                clientErrors: Math.round(point.clientErrors || 0),
                serverErrors: Math.round(point.serverErrors || 0),
                throttles: Math.round(point.throttles || 0),
            }))
            .filter((point) => point.clientErrors > 0 || point.serverErrors > 0 || point.throttles > 0)
            .slice(-6)
            .reverse();
    }, [metrics]);

    const failedInvocations = useMemo(() => {
        if (!metrics) return [];
        return metrics.invocations.filter((row) => row.status !== "success").slice(0, 5);
    }, [metrics]);

    const shouldShowErrorDiagnostics = !!metrics && (
        metrics.cards.totalErrors > 0 ||
        metrics.cards.throttles > 0 ||
        failedInvocations.length > 0
    );

    const reliabilityCards = useMemo(() => {
        if (!metrics) return [];
        const cards = [
            { label: "Invocations", value: metrics.cards.invocations.toLocaleString(), subtitle: undefined as string | undefined },
        ];
        if (metrics.cards.throttles > 0) {
            cards.push({
                label: "Throttles",
                value: metrics.cards.throttles.toLocaleString(),
                subtitle: `${metrics.cards.throttleRatePct.toFixed(2)}% rate`,
            });
        }
        if (metrics.cards.clientErrors > 0) {
            cards.push({ label: "Client Errors", value: metrics.cards.clientErrors.toLocaleString(), subtitle: "CloudWatch" });
        }
        if (metrics.cards.serverErrors > 0) {
            cards.push({ label: "Server Errors", value: metrics.cards.serverErrors.toLocaleString(), subtitle: "CloudWatch" });
        }
        if (metrics.cards.totalErrors > 0) {
            cards.push({
                label: "Error Rate",
                value: `${metrics.cards.errorRatePct.toFixed(2)}%`,
                subtitle: `${metrics.cards.totalErrors.toLocaleString()} errors`,
            });
        } else {
            cards.push({ label: "Reliability", value: "OK", subtitle: "No errors in window" });
        }
        return cards;
    }, [metrics]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Cpu className="w-4 h-4 text-primary" />AWS Bedrock Model Invocations
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Token usage, latency, throttles, errors, and recent request traces from AWS metrics + traced events
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {WINDOWS.map((w) => (
                            <button
                                key={w}
                                type="button"
                                onClick={() => setWindow(w)}
                                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border ${
                                    w === window ? "border-primary text-foreground bg-secondary/40" : "border-border text-muted-foreground"
                                }`}
                            >
                                {w}
                            </button>
                        ))}
                        <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading} className="h-8 text-xs font-mono gap-1.5">
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleSync} disabled={loading || syncing} className="h-8 text-xs font-mono gap-1.5">
                            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                            Sync 7d
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono uppercase">Region: {resolvedRegion}</Badge>
                    {metrics?.modelId ? <Badge variant="outline" className="text-[10px] font-mono">Model: {metrics.modelId}</Badge> : null}
                    {selectedRegion === "all" ? (
                        <Badge variant="secondary" className="text-[10px] font-mono">Region all uses us-east-1 for this panel</Badge>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        value={modelInput}
                        onChange={(e) => setModelInput(e.target.value)}
                        placeholder="Optional modelId filter (for example anthropic.claude-3-5-sonnet-20241022-v2:0)"
                        className="h-8 text-xs font-mono"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-mono"
                        onClick={() => setModelFilter(modelInput.trim())}
                    >
                        Apply
                    </Button>
                    {modelFilter ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-mono"
                            onClick={() => {
                                setModelInput("");
                                setModelFilter("");
                            }}
                        >
                            Clear
                        </Button>
                    ) : null}
                </div>
            </CardHeader>

            <CardContent className="space-y-5">
                {loading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {Array.from({ length: 10 }).map((_, idx) => (
                            <Skeleton key={idx} className="h-20" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="border border-red-300/30 bg-red-400/5 p-4">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                ) : metrics ? (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <KpiMini label="Input Tokens" value={formatTokens(metrics.cards.inputTokens)} />
                            <KpiMini label="Output Tokens" value={formatTokens(metrics.cards.outputTokens)} />
                            <KpiMini label="Total Tokens" value={formatTokens(metrics.cards.totalTokens)} />
                            <KpiMini label="Est. TPM" value={formatTokens(metrics.cards.estimatedTpm)} subtitle={`window ${metrics.window}`} />
                            {reliabilityCards.map((card) => (
                                <KpiMini key={card.label} label={card.label} value={card.value} subtitle={card.subtitle} />
                            ))}
                            <KpiMini
                                label="Latency"
                                value={
                                    metrics.cards.endToEndLatencyMs !== null
                                        ? `${Math.round(metrics.cards.endToEndLatencyMs)}ms`
                                        : "N/A"
                                }
                                subtitle={
                                    metrics.cards.timeToFirstTokenMs !== null
                                        ? `TTFT ${Math.round(metrics.cards.timeToFirstTokenMs)}ms`
                                        : "TTFT N/A"
                                }
                            />
                        </div>

                        {shouldShowErrorDiagnostics && (
                            <div className="border border-red-400/30 bg-red-400/5 p-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-red-400" />
                                        <p className="text-xs font-mono uppercase tracking-wider">Error Diagnostics</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="destructive" className="text-[10px] font-mono">
                                            Client {metrics.cards.clientErrors.toLocaleString()}
                                        </Badge>
                                        <Badge variant={metrics.cards.serverErrors > 0 ? "destructive" : "outline"} className="text-[10px] font-mono">
                                            Server {metrics.cards.serverErrors.toLocaleString()}
                                        </Badge>
                                        <Badge variant={metrics.cards.throttles > 0 ? "secondary" : "outline"} className="text-[10px] font-mono">
                                            Throttles {metrics.cards.throttles.toLocaleString()}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                    <div className="border border-border bg-card p-3">
                                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">CloudWatch Error Buckets</p>
                                        {errorBuckets.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">No timestamped error buckets returned for this window.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {errorBuckets.map((bucket) => (
                                                    <div key={`${bucket.timestamp}-${bucket.clientErrors}-${bucket.serverErrors}-${bucket.throttles}`} className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                                                        <div>
                                                            <p className="text-xs font-mono text-foreground">{bucket.label}</p>
                                                            <p className="text-[10px] text-muted-foreground">{new Date(bucket.timestamp).toLocaleDateString()}</p>
                                                        </div>
                                                        <div className="flex gap-1 flex-wrap justify-end">
                                                            {bucket.clientErrors > 0 && <Badge variant="destructive" className="text-[9px]">client {bucket.clientErrors}</Badge>}
                                                            {bucket.serverErrors > 0 && <Badge variant="destructive" className="text-[9px]">server {bucket.serverErrors}</Badge>}
                                                            {bucket.throttles > 0 && <Badge variant="secondary" className="text-[9px]">throttle {bucket.throttles}</Badge>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border border-border bg-card p-3">
                                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Recent Failed Request Logs</p>
                                        {failedInvocations.length === 0 ? (
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground">
                                                    CloudWatch reports errors, but no matching failed request logs are stored yet for this window.
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/70">
                                                    When traced events include status and errorMessage, the exact request ID and provider message will appear here.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {failedInvocations.map((row) => (
                                                    <div key={`${row.requestId}-${row.timestamp}`} className="border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <p className="text-xs font-mono text-foreground truncate">{row.model}</p>
                                                            <Badge variant={statusVariant(row.status)} className="text-[9px] shrink-0">{row.status}</Badge>
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground break-words">
                                                            {row.errorMessage || "No provider error message captured"}
                                                        </p>
                                                        <p className="text-[10px] font-mono text-muted-foreground/70 mt-1 break-all">
                                                            {row.requestId} - {new Date(row.timestamp).toLocaleString()}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <KpiMini
                                label="Short-Term Auth Requests"
                                value={authModeStats.shortTermRequests.toLocaleString()}
                                subtitle={authModeStats.total > 0 ? `${((authModeStats.shortTermRequests / authModeStats.total) * 100).toFixed(1)}% of traced` : undefined}
                            />
                            <KpiMini
                                label="Long-Term Auth Requests"
                                value={authModeStats.longTermRequests.toLocaleString()}
                                subtitle={authModeStats.total > 0 ? `${((authModeStats.longTermRequests / authModeStats.total) * 100).toFixed(1)}% of traced` : undefined}
                            />
                            <KpiMini
                                label="Unknown Auth Requests"
                                value={authModeStats.unknownRequests.toLocaleString()}
                                subtitle="Set metadata.authMode to improve split"
                            />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div className="border border-border p-3 bg-secondary/10 h-64">
                                <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mb-2">Reliability Timeline</p>
                                {reliabilityChart.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-6 text-center">No reliability time-series data in selected window.</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={reliabilityChart}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="invocations" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="throttles" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="clientErrors" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="serverErrors" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            <div className="border border-border p-3 bg-secondary/10 h-64">
                                <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mb-2">Request Distribution (Input Tokens)</p>
                                {distributionChart.every((row) => row.count === 0) ? (
                                    <p className="text-xs text-muted-foreground py-6 text-center">No traced request distribution yet.</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={distributionChart}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="var(--chart-3)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        <div className="border border-border p-3 bg-secondary/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Timer className="w-4 h-4 text-primary" />
                                <p className="text-xs font-mono uppercase tracking-wider">Auth Mode Breakdown</p>
                            </div>
                            {metrics.authModes.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No auth-mode traces yet. Send metadata.authMode = long_term or short_term in /ai-observability/events.</p>
                            ) : (
                                <div className="flex gap-2 flex-wrap">
                                    {metrics.authModes.map((mode) => (
                                        <Badge key={mode.mode} variant="outline" className="text-[10px] font-mono gap-1.5">
                                            {mode.mode}: {mode.requests} req / {formatTokens(mode.tokens)} tokens
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border border-border p-3 bg-secondary/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-4 h-4 text-primary" />
                                <p className="text-xs font-mono uppercase tracking-wider">Recent Invocations</p>
                            </div>
                            {metrics.invocations.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No traced invocation rows yet. Enable model invocation logging and/or post traced events to /ai-observability/events.</p>
                            ) : (
                                <div className="overflow-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left py-2 pr-2">Time</th>
                                                <th className="text-left py-2 pr-2">Request ID</th>
                                                <th className="text-left py-2 pr-2">Model</th>
                                                <th className="text-right py-2 pr-2">Tokens</th>
                                                <th className="text-right py-2 pr-2">Latency</th>
                                                <th className="text-left py-2 pr-2">Status</th>
                                                <th className="text-left py-2">Auth Mode</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {metrics.invocations.map((row) => (
                                                <tr key={`${row.requestId}-${row.timestamp}`} className="border-b border-border/40">
                                                    <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">
                                                        {new Date(row.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    </td>
                                                    <td className="py-2 pr-2 font-mono text-muted-foreground">{row.requestId.slice(0, 14)}...</td>
                                                    <td className="py-2 pr-2 font-mono">{row.model}</td>
                                                    <td className="py-2 pr-2 text-right">{row.totalTokens.toLocaleString()}</td>
                                                    <td className="py-2 pr-2 text-right">{row.latencyMs}ms</td>
                                                    <td className="py-2 pr-2">
                                                        <Badge variant={statusVariant(row.status)} className="text-[9px]">{row.status}</Badge>
                                                    </td>
                                                    <td className="py-2">
                                                        <Badge variant="outline" className="text-[9px]">{row.authMode}</Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="border border-border p-3 bg-secondary/10">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldAlert className="w-4 h-4 text-amber-400" />
                                <p className="text-xs font-mono uppercase tracking-wider">Notes</p>
                            </div>
                            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                                {metrics.notes.map((note, idx) => (
                                    <li key={idx}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    </>
                ) : null}
            </CardContent>
        </Card>
    );
}
