"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBar } from "../components/FilterBar";
import { useAiObservabilityFilters } from "@/hooks/useAiObservabilityFilters";
import { Building2, ChevronDown, ChevronUp, DollarSign, Layers, TrendingUp } from "@/icons";
import { Area, Bar, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CostResult } from "./api";
import { exportCSV } from "@/lib/exporters";
import { getAiProviderCompany } from "@/lib/ai-provider-company";
import { CostAttributionPanel } from "./components/CostAttributionPanel";
import { useCostTokens } from "./hooks/useCostTokens";

interface CompanyCostGroup {
    key: string;
    label: string;
    models: CostResult["modelBreakdown"];
    requests: number;
    tokens: number;
    cost: number;
}

function formatCost(value: number): string {
    if (value >= 1) return `$${value.toFixed(2)}`;
    if (value > 0) return `$${value.toFixed(4)}`;
    return "$0.00";
}

function formatTokens(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(value);
}

function KpiCard({ title, value, subtitle, icon: Icon, loading = false }: {
    title: string;
    value: string;
    subtitle?: string;
    icon?: React.ElementType;
    loading?: boolean;
}) {
    return (
        <div className="border p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase text-muted-foreground">{title}</p>
                {Icon && <Icon className="h-4 w-4 text-primary" />}
            </div>
            {loading ? <Skeleton className="mt-2 h-7 w-24" /> : <p className="mt-1 text-xl font-semibold">{value}</p>}
            {subtitle && <p className="mt-1 truncate text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
    );
}

export default function CostPage() {
    const { dateRange, setDateRange, provider, setProvider, reset } = useAiObservabilityFilters({ dateRange: "30d" });
    const { loading, costData, budget } = useCostTokens(dateRange, provider);
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (dateRange !== "30d") count++;
        if (provider !== "all") count++;
        return count;
    }, [dateRange, provider]);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setExpandedCompany(null); }, [dateRange, provider]);

    const cumulativeData = useMemo(() => {
        return (costData?.dailyTrend || []).reduce<
            Array<{ date: string; cost: number; label: string; cumulative: number }>
        >((acc, row) => {
            const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
            const cumulative = Math.round((prev + row.cost) * 1_000_000) / 1_000_000;
            acc.push({
                ...row,
                label: new Date(row.date).toLocaleDateString([], { month: "short", day: "numeric" }),
                cumulative,
            });
            return acc;
        }, []);
    }, [costData]);

    const companyGroups = useMemo<CompanyCostGroup[]>(() => {
        const grouped = new Map<string, CompanyCostGroup>();

        (costData?.modelBreakdown || []).forEach((row) => {
            const company = getAiProviderCompany(row.provider, row.model);
            const current = grouped.get(company.key) || {
                key: company.key,
                label: company.label,
                models: [],
                requests: 0,
                tokens: 0,
                cost: 0,
            };
            current.models.push(row);
            current.requests += row.requests;
            current.tokens += row.tokens;
            current.cost += row.cost;
            grouped.set(company.key, current);
        });

        (costData?.providerBreakdown || []).forEach((row) => {
            const company = getAiProviderCompany(row.provider);
            if (!grouped.has(company.key)) {
                grouped.set(company.key, {
                    key: company.key,
                    label: company.label,
                    models: [],
                    requests: row.requests,
                    tokens: 0,
                    cost: row.cost,
                });
            }
        });

        return Array.from(grouped.values())
            .map((group) => ({ ...group, models: group.models.sort((a, b) => b.cost - a.cost) }))
            .sort((a, b) => b.cost - a.cost);
    }, [costData]);

    const topCompany = companyGroups[0] || null;
    const topModel = costData?.modelBreakdown?.[0] || null;

    function handleExport() {
        exportCSV(companyGroups.flatMap((group) => {
            if (group.models.length === 0) {
                return [{ Company: group.label, Model: "Unattributed", Requests: group.requests, Tokens: group.tokens, Cost: group.cost }];
            }
            return group.models.map((model) => ({
                Company: group.label,
                Model: model.model,
                Provider: model.provider,
                Requests: model.requests,
                Tokens: model.tokens,
                Cost: model.cost,
            }));
        }), `ai-cost-breakdown-${dateRange}.csv`);
    }

    return (
        <div className="space-y-5">
            <header className="flex items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-secondary/40">
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">Cost by Company</h1>
                        <p className="text-xs text-muted-foreground">Company-level spend with model drill-down and 30-day retention.</p>
                    </div>
                </div>
                <Badge variant="outline" className="hidden h-7 text-[10px] sm:inline-flex">30-day retention</Badge>
            </header>

            <FilterBar
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                provider={provider}
                onProviderChange={setProvider}
                showSearch={false}
                showStatus={false}
                showExport={companyGroups.length > 0}
                onExport={handleExport}
                onReset={reset}
                activeFilterCount={activeFilterCount}
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <KpiCard title={`Spend (${dateRange})`} value={formatCost(costData?.totalSpend || 0)} icon={DollarSign} loading={loading} />
                <KpiCard title="Projected month" value={formatCost(costData?.projectedMonthlySpend || 0)} icon={TrendingUp} loading={loading} />
                <KpiCard title="Average day" value={formatCost(costData?.avgDailySpend || 0)} loading={loading} />
                <KpiCard title="Top company" value={topCompany?.label || "-"} icon={Building2} loading={loading} />
                <KpiCard title="Costliest model" value={topModel ? formatCost(topModel.cost) : "-"} subtitle={topModel?.model} icon={Layers} loading={loading} />
            </div>

            {budget?.rule && (
                <div className="border p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium">Monthly budget</p>
                            <p className="text-[10px] text-muted-foreground">{formatCost(budget.currentMonthSpend)} of {formatCost(budget.rule.monthlyLimit)}</p>
                        </div>
                        <Badge variant={budget.isMonthlyExceeded ? "destructive" : "outline"}>{budget.monthlyUsagePercent.toFixed(1)}%</Badge>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden bg-secondary">
                        <div
                            className={budget.monthlyUsagePercent > 90 ? "h-full bg-red-500" : budget.monthlyUsagePercent > 70 ? "h-full bg-amber-500" : "h-full bg-green-500"}
                            style={{ width: `${Math.min(budget.monthlyUsagePercent, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cumulative spend</CardTitle>
                    <CardDescription className="text-xs">Daily cost and running total for the selected period.</CardDescription>
                </CardHeader>
                <CardContent className="h-64 min-h-0 min-w-0 pt-2">
                    {loading ? (
                        <Skeleton className="h-full w-full" />
                    ) : cumulativeData.length === 0 ? (
                        <div className="flex h-full items-center justify-center border border-dashed text-xs text-muted-foreground">No cost data yet.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <ComposedChart data={cumulativeData}>
                                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} width={52} />
                                <Tooltip formatter={(value) => formatCost(Number(value || 0))} />
                                <Area type="monotone" dataKey="cumulative" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.12} strokeWidth={2} />
                                <Bar dataKey="cost" fill="var(--chart-1)" opacity={0.45} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {costData && costData.unpricedModels.length > 0 && (
                <div className="border border-amber-500/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium text-amber-600">Unpriced usage</p>
                            <p className="text-[10px] text-muted-foreground">Token usage exists for models without configured pricing.</p>
                        </div>
                        <Badge variant="secondary">{costData.unpricedModels.length}</Badge>
                    </div>
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    <div className="border-b px-4 py-3">
                        <p className="text-sm font-semibold">Company spend</p>
                        <p className="text-xs text-muted-foreground">{companyGroups.length} companies in the selected period</p>
                    </div>
                    {loading ? (
                        <div className="space-y-3 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
                    ) : companyGroups.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">No company spend data.</div>
                    ) : (
                        <div className="divide-y">
                            {companyGroups.map((group) => {
                                const isExpanded = expandedCompany === group.key;
                                const share = costData?.totalSpend ? (group.cost / costData.totalSpend) * 100 : 0;
                                return (
                                    <section key={group.key}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCompany(isExpanded ? null : group.key)}
                                            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left transition hover:bg-secondary/20 lg:grid-cols-[minmax(220px,1.3fr)_100px_100px_110px_140px_36px]"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                                                <div className="min-w-0">
                                                    <p className="font-medium">{group.label}</p>
                                                    <p className="truncate text-[10px] text-muted-foreground">{group.models.length} attributed model{group.models.length === 1 ? "" : "s"}</p>
                                                </div>
                                            </div>
                                            <div className="hidden text-right lg:block">
                                                <p className="font-mono text-sm">{group.requests.toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground">requests</p>
                                            </div>
                                            <div className="hidden text-right lg:block">
                                                <p className="font-mono text-sm">{formatTokens(group.tokens)}</p>
                                                <p className="text-[10px] text-muted-foreground">tokens</p>
                                            </div>
                                            <div className="hidden text-right lg:block">
                                                <p className="font-mono text-sm">{formatCost(group.cost)}</p>
                                                <p className="text-[10px] text-muted-foreground">{share.toFixed(1)}% of spend</p>
                                            </div>
                                            <div className="hidden lg:block">
                                                <div className="h-2 overflow-hidden bg-secondary">
                                                    <div className="h-full bg-primary" style={{ width: `${Math.min(share, 100)}%` }} />
                                                </div>
                                            </div>
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md border">
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t bg-secondary/10 px-4 py-3">
                                                {group.models.length === 0 ? (
                                                    <p className="py-3 text-xs text-muted-foreground">No model-level records are available for this company.</p>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full min-w-[720px] text-xs">
                                                            <thead>
                                                                <tr className="text-left uppercase text-muted-foreground">
                                                                    <th className="pb-2 pr-3">Model</th>
                                                                    <th className="pb-2 pr-3 text-right">Requests</th>
                                                                    <th className="pb-2 pr-3 text-right">Tokens</th>
                                                                    <th className="pb-2 pr-3 text-right">Cost</th>
                                                                    <th className="pb-2 text-right">Cost / 1K</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {group.models.map((model) => (
                                                                    <tr key={`${model.provider}-${model.model}`} className="border-t">
                                                                        <td className="py-2.5 pr-3 font-mono">{model.model}</td>
                                                                        <td className="py-2.5 pr-3 text-right">{model.requests.toLocaleString()}</td>
                                                                        <td className="py-2.5 pr-3 text-right">{formatTokens(model.tokens)}</td>
                                                                        <td className="py-2.5 pr-3 text-right font-medium">{formatCost(model.cost)}</td>
                                                                        <td className="py-2.5 text-right">{model.tokens ? formatCost((model.cost / model.tokens) * 1000) : "-"}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <CostAttributionPanel />
        </div>
    );
}
