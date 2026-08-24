"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBar } from "../components/FilterBar";
import { useAiObservabilityFilters } from "@/hooks/useAiObservabilityFilters";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, ChevronDown, ChevronUp, Cpu } from "@/icons";
import type { ModelRow } from "./api";
import { exportCSV } from "@/lib/exporters";
import { getAiProviderCompany } from "@/lib/ai-provider-company";
import { useModelUsage } from "./hooks/useModelUsage";

interface EnrichedModel extends ModelRow {
    efficiency: number;
    errorRate: number;
}

interface CompanyGroup {
    key: string;
    label: string;
    models: EnrichedModel[];
    requests: number;
    avgLatency: number;
    errors: number;
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

export default function ModelsPage() {
    const { dateRange, setDateRange, provider, setProvider, search, setSearch, reset } = useAiObservabilityFilters({ dateRange: "30d" });
    const { loading, models } = useModelUsage(dateRange, provider);
    const [selected, setSelected] = useState<EnrichedModel | null>(null);
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (dateRange !== "30d") count++;
        if (provider !== "all") count++;
        if (search) count++;
        return count;
    }, [dateRange, provider, search]);

    useEffect(() => { setExpandedCompany(null); }, [dateRange, provider, search]);

    const groups = useMemo<CompanyGroup[]>(() => {
        const query = search.trim().toLowerCase();
        const grouped = new Map<string, CompanyGroup>();

        models.forEach((model) => {
            const company = getAiProviderCompany(model.provider, model.model);
            if (query && !model.model.toLowerCase().includes(query) && !company.label.toLowerCase().includes(query)) return;

            const enriched: EnrichedModel = {
                ...model,
                efficiency: model.totalCost > 0 ? Math.round(model.totalTokens / model.totalCost) : 0,
                errorRate: model.requests > 0 ? (model.errorCount / model.requests) * 100 : 0,
            };
            const current = grouped.get(company.key) || {
                key: company.key,
                label: company.label,
                models: [],
                requests: 0,
                avgLatency: 0,
                errors: 0,
                tokens: 0,
                cost: 0,
            };
            current.models.push(enriched);
            current.requests += model.requests;
            current.avgLatency += model.avgLatency * model.requests;
            current.errors += model.errorCount;
            current.tokens += model.totalTokens;
            current.cost += model.totalCost;
            grouped.set(company.key, current);
        });

        return Array.from(grouped.values())
            .map((group) => ({
                ...group,
                avgLatency: group.requests ? Math.round(group.avgLatency / group.requests) : 0,
                models: group.models.sort((a, b) => b.requests - a.requests),
            }))
            .sort((a, b) => b.requests - a.requests);
    }, [models, search]);

    const totals = useMemo(() => groups.reduce((summary, group) => ({
        requests: summary.requests + group.requests,
        errors: summary.errors + group.errors,
        tokens: summary.tokens + group.tokens,
        cost: summary.cost + group.cost,
    }), { requests: 0, errors: 0, tokens: 0, cost: 0 }), [groups]);

    function handleExport() {
        exportCSV(groups.flatMap((group) => group.models.map((model) => ({
            Company: group.label,
            Model: model.model,
            Provider: model.provider,
            Requests: model.requests,
            "Avg Latency (ms)": model.avgLatency,
            Errors: model.errorCount,
            "Error Rate (%)": model.errorRate.toFixed(2),
            Tokens: model.totalTokens,
            "Tokens/$": model.efficiency,
            Cost: model.totalCost,
        }))), `ai-models-${dateRange}.csv`);
    }

    return (
        <div className="space-y-5">
            <header className="flex items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-secondary/40">
                        <Cpu className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">Model Companies</h1>
                        <p className="text-xs text-muted-foreground">Provider-level performance with model drill-down and 30-day retention.</p>
                    </div>
                </div>
                <Badge variant="outline" className="hidden h-7 text-[10px] sm:inline-flex">30-day retention</Badge>
            </header>

            <FilterBar
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                provider={provider}
                onProviderChange={setProvider}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search companies or models"
                showExport={groups.length > 0}
                onExport={handleExport}
                onReset={reset}
                activeFilterCount={activeFilterCount}
            />

            {!loading && groups.length > 0 && (
                <div className="grid grid-cols-2 border md:grid-cols-4">
                    {[
                        ["Companies", groups.length.toLocaleString()],
                        ["Requests", totals.requests.toLocaleString()],
                        ["Tokens", formatTokens(totals.tokens)],
                        ["Spend", formatCost(totals.cost)],
                    ].map(([label, value]) => (
                        <div key={label} className="border-b p-3 last:border-b-0 odd:border-r md:border-b-0 md:border-r md:last:border-r-0">
                            <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                            <p className="mt-1 text-lg font-semibold">{value}</p>
                        </div>
                    ))}
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="space-y-3 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
                    ) : groups.length === 0 ? (
                        <div className="py-16 text-center">
                            <Cpu className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">{models.length === 0 ? "No model usage recorded yet." : "No companies match your filters."}</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {groups.map((group) => {
                                const isExpanded = expandedCompany === group.key;
                                const errorRate = group.requests ? (group.errors / group.requests) * 100 : 0;

                                return (
                                    <section key={group.key}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCompany(isExpanded ? null : group.key)}
                                            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left transition hover:bg-secondary/20 xl:grid-cols-[minmax(220px,1.3fr)_100px_110px_100px_110px_36px]"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-primary" />
                                                    <p className="font-medium">{group.label}</p>
                                                    <Badge variant="outline" className="text-[9px]">{group.models.length} model{group.models.length === 1 ? "" : "s"}</Badge>
                                                </div>
                                                <p className="mt-1 truncate pl-6 text-xs text-muted-foreground">
                                                    {group.models.slice(0, 3).map((model) => model.model).join(", ")}
                                                </p>
                                            </div>
                                            <div className="hidden text-right xl:block">
                                                <p className="font-mono text-sm">{group.requests.toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground">requests</p>
                                            </div>
                                            <div className="hidden text-right xl:block">
                                                <p className="font-mono text-sm">{group.avgLatency}ms</p>
                                                <p className="text-[10px] text-muted-foreground">avg latency</p>
                                            </div>
                                            <div className="hidden text-right xl:block">
                                                <p className={group.errors ? "font-mono text-sm text-red-500" : "font-mono text-sm"}>{errorRate.toFixed(1)}%</p>
                                                <p className="text-[10px] text-muted-foreground">error rate</p>
                                            </div>
                                            <div className="hidden text-right xl:block">
                                                <p className="font-mono text-sm">{formatCost(group.cost)}</p>
                                                <p className="text-[10px] text-muted-foreground">spend</p>
                                            </div>
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md border">
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t bg-secondary/10 px-4 py-3">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full min-w-[820px] text-xs">
                                                        <thead>
                                                            <tr className="text-left uppercase text-muted-foreground">
                                                                <th className="pb-2 pr-3">Model</th>
                                                                <th className="pb-2 pr-3 text-right">Requests</th>
                                                                <th className="pb-2 pr-3 text-right">Latency</th>
                                                                <th className="pb-2 pr-3 text-right">Errors</th>
                                                                <th className="pb-2 pr-3 text-right">Tokens</th>
                                                                <th className="pb-2 text-right">Cost</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.models.map((model) => (
                                                                <tr
                                                                    key={`${model.provider}-${model.model}`}
                                                                    onClick={() => setSelected(model)}
                                                                    className="cursor-pointer border-t transition hover:bg-background"
                                                                >
                                                                    <td className="py-2.5 pr-3 font-mono">{model.model}</td>
                                                                    <td className="py-2.5 pr-3 text-right">{model.requests.toLocaleString()}</td>
                                                                    <td className="py-2.5 pr-3 text-right">{model.avgLatency}ms</td>
                                                                    <td className="py-2.5 pr-3 text-right">
                                                                        <span className={model.errorCount ? "text-red-500" : ""}>{model.errorCount}</span>
                                                                        {model.errorRate > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({model.errorRate.toFixed(1)}%)</span>}
                                                                    </td>
                                                                    <td className="py-2.5 pr-3 text-right">{formatTokens(model.totalTokens)}</td>
                                                                    <td className="py-2.5 text-right font-medium">{formatCost(model.totalCost)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="break-words font-mono text-base">{selected?.model}</DialogTitle>
                        <DialogDescription>{selected ? getAiProviderCompany(selected.provider, selected.model).label : ""}</DialogDescription>
                    </DialogHeader>
                    {selected && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {[
                                ["Requests", selected.requests.toLocaleString()],
                                ["Avg latency", `${selected.avgLatency}ms`],
                                ["Error rate", `${selected.errorRate.toFixed(1)}%`],
                                ["Tokens", formatTokens(selected.totalTokens)],
                                ["Tokens / $", selected.efficiency ? formatTokens(selected.efficiency) : "-"],
                                ["Cost", formatCost(selected.totalCost)],
                            ].map(([label, value]) => (
                                <div key={label} className="border p-3">
                                    <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                                    <p className="mt-1 text-sm font-semibold">{value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
