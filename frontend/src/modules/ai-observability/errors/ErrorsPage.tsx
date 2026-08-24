"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBar } from "../components/FilterBar";
import { useAiObservabilityFilters } from "@/hooks/useAiObservabilityFilters";
import { AlertTriangle, Building2, ChevronDown, ChevronUp } from "@/icons";
import { exportCSV } from "@/lib/exporters";
import { getAiProviderCompany } from "@/lib/ai-provider-company";
import type { AiErrorRow, BedrockCloudwatchErrorRow } from "./api";
import { useErrors } from "./hooks/useErrors";

type UnifiedErrorRow =
    | { kind: "app"; sortTime: number; count: number; row: AiErrorRow }
    | { kind: "cloudwatch"; sortTime: number; count: number; row: BedrockCloudwatchErrorRow };

interface ErrorSignature {
    id: string;
    label: string;
    model: string;
    status: string;
    count: number;
    latestAt: number;
    avgLatency: number;
    events: UnifiedErrorRow[];
}

interface CompanyErrorGroup {
    key: string;
    label: string;
    events: UnifiedErrorRow[];
    signatures: ErrorSignature[];
    count: number;
    latestAt: number;
    timeouts: number;
    rateLimited: number;
}

function statusBadgeVariant(status: string): "destructive" | "secondary" | "outline" {
    if (status === "error") return "destructive";
    if (status === "rate_limited" || status === "timeout") return "secondary";
    return "outline";
}

function normalizeErrorMessage(message?: string) {
    return (message || "No message captured")
        .replace(/[a-f0-9]{20,}/gi, "{id}")
        .replace(/\b\d{3,}\b/g, "{n}")
        .replace(/\s+/g, " ")
        .trim();
}

function eventModel(event: UnifiedErrorRow) {
    return event.kind === "app" ? event.row.modelName : "CloudWatch metric";
}

function eventStatus(event: UnifiedErrorRow) {
    return event.row.status;
}

function eventMessage(event: UnifiedErrorRow) {
    return event.kind === "app"
        ? event.row.errorMessage || "No message captured"
        : `${event.row.errorType}: ${event.row.errorMessage}`;
}

function eventProvider(event: UnifiedErrorRow) {
    return event.row.provider;
}

// Best-effort HTTP-ish status code from the message (e.g. "[503 …]"), falling
// back to the coarse status. Small and pure so new error shapes are easy to add.
function eventCode(event: UnifiedErrorRow): string {
    const message = eventMessage(event);
    const bracket = message.match(/\[(\d{3})\b/);
    const loose = message.match(/\b([1-5]\d{2})\b/);
    if (bracket) return bracket[1];
    if (loose) return loose[1];
    const status = eventStatus(event);
    if (status === "rate_limited") return "429";
    if (status === "timeout") return "timeout";
    return status || "error";
}

// Region when the event carries one (app metadata today; a dedicated field
// later). Returns null when unknown so the row can omit it cleanly.
function eventRegion(event: UnifiedErrorRow): string | null {
    if (event.kind !== "app") return null;
    const meta = event.row.metadata as Record<string, unknown> | undefined;
    const region = meta?.region ?? meta?.location ?? meta?.awsRegion;
    return typeof region === "string" && region.trim() ? region : null;
}

function groupErrors(events: UnifiedErrorRow[]): CompanyErrorGroup[] {
    const companies = new Map<string, CompanyErrorGroup>();

    events.forEach((event) => {
        const company = getAiProviderCompany(eventProvider(event), eventModel(event));
        const current = companies.get(company.key) || {
            key: company.key,
            label: company.label,
            events: [],
            signatures: [],
            count: 0,
            latestAt: 0,
            timeouts: 0,
            rateLimited: 0,
        };
        current.events.push(event);
        current.count += event.count;
        current.latestAt = Math.max(current.latestAt, event.sortTime);
        if (eventStatus(event) === "timeout") current.timeouts += event.count;
        if (eventStatus(event) === "rate_limited") current.rateLimited += event.count;
        companies.set(company.key, current);
    });

    return Array.from(companies.values()).map((company) => {
        const signatures = new Map<string, ErrorSignature>();
        company.events.forEach((event) => {
            const model = eventModel(event);
            const status = eventStatus(event);
            const normalizedMessage = normalizeErrorMessage(eventMessage(event));
            const id = `${status}:${model}:${normalizedMessage}`;
            const current = signatures.get(id) || {
                id,
                label: normalizedMessage,
                model,
                status,
                count: 0,
                latestAt: 0,
                avgLatency: 0,
                events: [],
            };
            current.events.push(event);
            current.count += event.count;
            current.latestAt = Math.max(current.latestAt, event.sortTime);
            if (event.kind === "app") current.avgLatency += event.row.latencyMs;
            signatures.set(id, current);
        });

        company.signatures = Array.from(signatures.values())
            .map((signature) => ({
                ...signature,
                avgLatency: signature.events.filter((event) => event.kind === "app").length
                    ? Math.round(signature.avgLatency / signature.events.filter((event) => event.kind === "app").length)
                    : 0,
                events: signature.events.sort((a, b) => b.sortTime - a.sortTime),
            }))
            .sort((a, b) => b.count - a.count || b.latestAt - a.latestAt);
        return company;
    }).sort((a, b) => b.count - a.count || b.latestAt - a.latestAt);
}

export default function ErrorsPage() {
    const { dateRange, setDateRange, provider, setProvider, status, setStatus, search, setSearch, reset } = useAiObservabilityFilters({ dateRange: "30d" });
    const { loading, errors, cloudwatchErrors } = useErrors(dateRange, provider, status);
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
    const [expandedSignature, setExpandedSignature] = useState<string | null>(null);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (dateRange !== "30d") count++;
        if (provider !== "all") count++;
        if (status !== "all") count++;
        if (search) count++;
        return count;
    }, [dateRange, provider, status, search]);

    useEffect(() => {
        setExpandedCompany(null);
        setExpandedSignature(null);
    }, [dateRange, provider, status, search]);

    const combinedRows = useMemo<UnifiedErrorRow[]>(() => {
        const query = search.trim().toLowerCase();
        const appRows = errors
            .filter((error) => !query || [
                error.modelName,
                error.provider,
                error.requestId,
                error.errorMessage || "",
            ].some((value) => value.toLowerCase().includes(query)))
            .map((row) => ({ kind: "app" as const, sortTime: new Date(row.createdAt).getTime(), count: 1, row }));

        const cloudRows = cloudwatchErrors
            .filter((error) => provider === "all" || provider === "bedrock")
            .filter((error) => !query || `${error.errorType} ${error.errorMessage} ${error.provider}`.toLowerCase().includes(query))
            .map((row) => ({ kind: "cloudwatch" as const, sortTime: new Date(row.timestamp).getTime(), count: row.errorCount, row }));

        return [...appRows, ...cloudRows].sort((a, b) => b.sortTime - a.sortTime);
    }, [errors, cloudwatchErrors, provider, search]);

    const companies = useMemo(() => groupErrors(combinedRows), [combinedRows]);
    const totals = useMemo(() => ({
        count: companies.reduce((sum, company) => sum + company.count, 0),
        signatures: companies.reduce((sum, company) => sum + company.signatures.length, 0),
        timeouts: companies.reduce((sum, company) => sum + company.timeouts, 0),
        rateLimited: companies.reduce((sum, company) => sum + company.rateLimited, 0),
    }), [companies]);

    function handleExport() {
        exportCSV(combinedRows.map((event) => ({
            Company: getAiProviderCompany(eventProvider(event), eventModel(event)).label,
            Time: new Date(event.sortTime).toISOString(),
            Provider: eventProvider(event),
            Model: eventModel(event),
            Status: eventStatus(event),
            Code: eventCode(event),
            Region: eventRegion(event) || "",
            Count: event.count,
            Error: eventMessage(event),
            "Request ID": event.kind === "app" ? event.row.requestId : "CloudWatch metric",
            "Latency (ms)": event.kind === "app" ? event.row.latencyMs : "N/A",
        })), `ai-errors-${dateRange}.csv`);
    }

    return (
        <div className="space-y-5">
            <header className="flex items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-secondary/40">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">Errors by Company</h1>
                        <p className="text-xs text-muted-foreground">Repeated failures grouped into signatures with 30-day retention.</p>
                    </div>
                </div>
                <Badge variant="outline" className="hidden h-7 text-[10px] sm:inline-flex">30-day retention</Badge>
            </header>

            <FilterBar
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                provider={provider}
                onProviderChange={setProvider}
                status={status}
                onStatusChange={setStatus}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search companies, models, errors, or request IDs"
                showStatus
                showExport={combinedRows.length > 0}
                onExport={handleExport}
                onReset={reset}
                activeFilterCount={activeFilterCount}
            />

            {!loading && companies.length > 0 && (
                <div className="grid grid-cols-2 border md:grid-cols-4">
                    {[
                        ["Events", totals.count.toLocaleString()],
                        ["Signatures", totals.signatures.toLocaleString()],
                        ["Timeouts", totals.timeouts.toLocaleString()],
                        ["Rate limited", totals.rateLimited.toLocaleString()],
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
                    ) : companies.length === 0 ? (
                        <div className="py-16 text-center">
                            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No errors match the current filters.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {companies.map((company) => {
                                const isExpanded = expandedCompany === company.key;
                                return (
                                    <section key={company.key}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCompany(isExpanded ? null : company.key)}
                                            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left transition hover:bg-secondary/20 lg:grid-cols-[minmax(220px,1.3fr)_100px_100px_120px_36px]"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                                                <div className="min-w-0">
                                                    <p className="font-medium">{company.label}</p>
                                                    <p className="truncate text-[10px] text-muted-foreground">{company.signatures.length} repeated failure signature{company.signatures.length === 1 ? "" : "s"}</p>
                                                </div>
                                            </div>
                                            <div className="hidden text-right lg:block">
                                                <p className="font-mono text-sm text-red-500">{company.count.toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground">events</p>
                                            </div>
                                            <div className="hidden text-right lg:block">
                                                <p className="font-mono text-sm">{company.timeouts.toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground">timeouts</p>
                                            </div>
                                            <div className="hidden text-right lg:block">
                                                <p className="text-xs">{new Date(company.latestAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                                                <p className="text-[10px] text-muted-foreground">latest event</p>
                                            </div>
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md border">
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t bg-secondary/10">
                                                {company.signatures.map((signature) => {
                                                    const signatureKey = `${company.key}:${signature.id}`;
                                                    const signatureExpanded = expandedSignature === signatureKey;
                                                    return (
                                                        <div key={signature.id} className="border-b last:border-b-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedSignature(signatureExpanded ? null : signatureKey)}
                                                                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-6 py-3 text-left transition hover:bg-background/70 lg:grid-cols-[minmax(240px,1.5fr)_180px_90px_100px_32px]"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-xs font-medium">{signature.label}</p>
                                                                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{signature.model}</p>
                                                                </div>
                                                                <div className="hidden lg:block"><Badge variant={statusBadgeVariant(signature.status)}>{signature.status}</Badge></div>
                                                                <div className="hidden text-right lg:block">
                                                                    <p className="font-mono text-xs">{signature.count.toLocaleString()}</p>
                                                                    <p className="text-[10px] text-muted-foreground">events</p>
                                                                </div>
                                                                <div className="hidden text-right lg:block">
                                                                    <p className="font-mono text-xs">{signature.avgLatency ? `${signature.avgLatency}ms` : "-"}</p>
                                                                    <p className="text-[10px] text-muted-foreground">avg latency</p>
                                                                </div>
                                                                <div className="flex h-7 w-7 items-center justify-center">
                                                                    {signatureExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                                </div>
                                                            </button>

                                                            {signatureExpanded && (
                                                                <div className="border-t bg-background px-6 py-3">
                                                                    <div className="space-y-2">
                                                                        {signature.events.map((event, index) => (
                                                                            <div key={`${event.sortTime}-${index}`} className="flex flex-col gap-2 border p-3 text-xs md:flex-row md:items-start md:justify-between">
                                                                                <div className="min-w-0">
                                                                                    <p className="line-clamp-5 whitespace-pre-wrap wrap-break-word leading-relaxed">{eventMessage(event)}</p>
                                                                                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                                                                        {new Date(event.sortTime).toLocaleString()} / {event.count} event{event.count === 1 ? "" : "s"}
                                                                                    </p>
                                                                                </div>
                                                                                {/* Inline code + region. The dedicated request page
                                                                                    (/ai-observability/request/[id]) is intentionally not
                                                                                    linked here; it stays available for a future error type
                                                                                    that needs a full drill-down. */}
                                                                                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                                                                    <Badge variant={statusBadgeVariant(eventStatus(event))} className="font-mono text-[10px]">
                                                                                        {eventCode(event)}
                                                                                    </Badge>
                                                                                    {eventRegion(event) && (
                                                                                        <Badge variant="outline" className="text-[10px]">{eventRegion(event)}</Badge>
                                                                                    )}
                                                                                    {event.kind === "cloudwatch" && (
                                                                                        <Badge variant="outline" className="text-[10px]">CloudWatch</Badge>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
