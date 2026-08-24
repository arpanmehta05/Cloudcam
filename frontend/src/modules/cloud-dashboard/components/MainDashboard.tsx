"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertTriangle,
    ArrowUpRight,
    BellRing,
    Boxes,
    Clock,
    CloudIcon,
    Cpu,
    RefreshCw,
    Rocket,
    ShieldCheck,
    Sparkles,
    TrendingDown,
    Wand2,
    Wallet,
} from "@/icons";
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LivePulse } from "@/components/LivePulse";
import { authFetch, ApiClientError } from "@/lib/auth-fetch";
import { useRegion } from "@/context/RegionContext";
import { AllCloudDashboard } from "@/components/cloud/AllCloudDashboard";

interface DashboardMetrics {
    cpuData: { timestamp: string; value: number }[];
    currentCpu: number;
    cpuTrend: "up" | "down" | "stable";
    mtdSpend: number;
    mtdLabel: string;
    spendUnit: string;
    projectedSpend: number | null;
    resourceCount: number;
    lambdaErrors: number;
    securityThreats: number;
    highRiskFindings: number;
    spendLocked?: boolean;
}

type TileId = "cpu" | "spend" | "resources" | "security";
type PanelId = "telemetry" | "serviceMap";
type WorkflowId = "workflowSpend" | "workflowAlerts" | "workflowOptimization" | "workflowSimulations";
type WidgetId = TileId | PanelId | WorkflowId;

const timeRanges = ["1h", "6h", "24h", "7d"];
const AUTO_REFRESH_SECONDS = 60;
const defaultWidgetOrder: WidgetId[] = [
    "cpu",
    "spend",
    "resources",
    "security",
    "telemetry",
    "serviceMap",
    "workflowSpend",
    "workflowAlerts",
    "workflowOptimization",
    "workflowSimulations",
];

const workflowCards = [
    {
        title: "Spend guardrails",
        label: "FinOps",
        icon: Wallet,
        accent: "#F97316",
        body: "Forecast drift, waste, and savings actions grouped into review-ready work.",
        stat: "4 checks",
        href: "/dashboards/cost",
    },
    {
        title: "Alert routing",
        label: "Ops",
        icon: BellRing,
        accent: "#EF4444",
        body: "Health, risk, owner, and action signals stay tied to the affected AWS surface.",
        stat: "Live",
        href: "/ai-observability/alerts",
    },
    {
        title: "Optimization queue",
        label: "AI",
        icon: Wand2,
        accent: "#1A56DB",
        body: "Recommendations are staged as small, inspectable actions before execution.",
        stat: "12 ready",
        href: "/actions",
    },
    {
        title: "Simulation history",
        label: "Infra",
        icon: Rocket,
        accent: "#8B5CF6",
        body: "Persistent history of infrastructure simulations, HCL state, and SSH keys.",
        stat: "Active",
        href: "/simulations",
    },
];

const serviceSignals = [
    { label: "Compute", value: "EC2 / Lambda", accent: "#1A56DB" },
    { label: "Data", value: "RDS / S3", accent: "#06B6D4" },
    { label: "Security", value: "Hub / IAM", accent: "#22C55E" },
    { label: "FinOps", value: "Cost Explorer", accent: "#F97316" },
];

const workflowById: Record<string, (typeof workflowCards)[number]> = {
    workflowSpend: workflowCards[0],
    workflowAlerts: workflowCards[1],
    workflowOptimization: workflowCards[2],
    workflowSimulations: workflowCards[3],
};

function formatSpend(value?: number, unit = "USD") {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: unit || "USD",
            maximumFractionDigits: 2,
        }).format(value || 0);
    } catch {
        const prefix = unit === "USD" || unit === "$" ? "$" : `${unit} `;
        return `${prefix}${(value || 0).toFixed(2)}`;
    }
}

const CommandCenterAutoRefresh = memo(function CommandCenterAutoRefresh({
    onRefresh,
}: {
    onRefresh: () => void;
}) {
    const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
    const refreshRef = useRef(onRefresh);

    useEffect(() => {
        refreshRef.current = onRefresh;
        setCountdown(AUTO_REFRESH_SECONDS);
    }, [onRefresh]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCountdown((current) => {
                if (current <= 1) {
                    setTimeout(() => refreshRef.current(), 0);
                    return AUTO_REFRESH_SECONDS;
                }
                return current - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    return (
        <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-bold text-[#64748B] shadow-sm dark:border-[#334155] dark:bg-[#0B1728] dark:text-[#94A3B8]">
            <Clock className="h-4 w-4" />
            {countdown}s
        </span>
    );
});

export function MainDashboard() {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>("");
    const [notConnected, setNotConnected] = useState(false);
    const [selectedRange, setSelectedRange] = useState("24h");
    const { selectedProvider, selectedRegion } = useRegion();
    const abortRef = useRef<AbortController | null>(null);
    const inFlightRef = useRef(false);

    const [viewMode, setViewMode] = useState<"single" | "all">(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("cloudwatcher.dashboard.viewMode");
            if (saved === "single" || saved === "all") return saved;
        }
        return "single";
    });

    const handleViewModeChange = (mode: "single" | "all") => {
        setViewMode(mode);
        if (typeof window !== "undefined") {
            localStorage.setItem("cloudwatcher.dashboard.viewMode", mode);
        }
    };

    const fetchDashboardData = useCallback(async (options?: { forceRefresh?: boolean; background?: boolean }) => {
        if (options?.background && inFlightRef.current) return;

        if (!options?.background) setLoading(true);
        inFlightRef.current = true;
        if (!options?.background) abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const forceRefresh = options?.forceRefresh !== false;
        const requestOptions = {
            signal: controller.signal,
            headers: forceRefresh ? { "x-rabbittwatch-cache-bypass": "true" } : undefined,
        };
        const forceRefreshParam = forceRefresh ? "&forceRefresh=true" : "";

        try {
            const [metricsRes, billingRes, resourcesRes, securityRes] = await Promise.all([
                authFetch(`/api/${selectedProvider}/metrics?service=ec2&range=${selectedRange}&region=${selectedRegion}${forceRefreshParam}`, requestOptions),
                authFetch(`/api/${selectedProvider}/billing?range=${selectedRange}${forceRefreshParam}`, requestOptions),
                authFetch(`/api/${selectedProvider}/resources?region=${selectedRegion}${forceRefreshParam}`, requestOptions),
                authFetch(`/api/${selectedProvider}/security?region=${selectedRegion}${forceRefreshParam}`, requestOptions)
            ]);

            let billingData: any = null;
            let billingLocked = false;

            const [metricsData, resourcesData, securityData] = await Promise.all([
                metricsRes.json(),
                resourcesRes.json(),
                securityRes.json()
            ]);

            try {
                billingData = await billingRes.json();
            } catch (err: any) {
                if (err instanceof ApiClientError && err.status === 403) {
                    billingLocked = true;
                    billingData = {
                        summary: {
                            mtdSpend: 0,
                            unit: "USD",
                            projectedTotal: null
                        }
                    };
                } else {
                    throw err;
                }
            }

            if ([metricsData, billingData, resourcesData, securityData].some(d => d.notConnected)) {
                setNotConnected(true);
                if (!options?.background) setLoading(false);
                return;
            }

            const cpuSeries = metricsData.metrics?.cpu?.data || [];
            const currentCpu = cpuSeries.length > 0 ? cpuSeries[cpuSeries.length - 1].value : 0;

            let trend: "up" | "down" | "stable" = "stable";
            if (cpuSeries.length >= 2) {
                const last = cpuSeries[cpuSeries.length - 1].value;
                const prev = cpuSeries[cpuSeries.length - 2].value;
                if (last > prev * 1.05) trend = "up";
                else if (last < prev * 0.95) trend = "down";
            }

            setMetrics({
                cpuData: cpuSeries,
                currentCpu: Math.round(currentCpu * 10) / 10,
                cpuTrend: trend,
                mtdSpend: billingData.summary?.mtdSpend || billingData.summary?.currentSpend || 0,
                mtdLabel: "MTD Spend",
                spendUnit: billingData.summary?.unit || "USD",
                projectedSpend: billingData.summary?.projectedTotal || null,
                resourceCount: resourcesData.inventory?.counts?.total || 0,
                lambdaErrors: 0,
                securityThreats: securityData.security?.threats?.count || 0,
                highRiskFindings: securityData.security?.compliance?.highRiskFindings || 0,
                spendLocked: billingLocked,
            });

            setNotConnected(false);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (error: any) {
            if (controller.signal.aborted || error?.name === "AbortError") return;
            if (error instanceof ApiClientError && error.status === 401) return;

            const isProviderNotConnected =
                Boolean(error?.notConnected) ||
                String(error?.message || "").toLowerCase().includes("not connected") ||
                String(error?.message || "").toLowerCase().includes("not configured");

            if (!isProviderNotConnected) {
                console.error(`Failed to fetch ${selectedProvider} dashboard data:`, error);
            }
            setNotConnected(true);
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
                inFlightRef.current = false;
            }
            if (!controller.signal.aborted) {
                if (!options?.background) setLoading(false);
            }
        }
    }, [selectedProvider, selectedRegion, selectedRange]);

    useEffect(() => {
        fetchDashboardData();
        return () => {
            abortRef.current?.abort();
        };
    }, [fetchDashboardData]);

    const handleRefresh = () => {
        fetchDashboardData({ forceRefresh: true });
    };

    const handleAutoRefresh = useCallback(() => {
        fetchDashboardData({ forceRefresh: true, background: true });
    }, [fetchDashboardData]);

    const securityIssues = (metrics?.securityThreats || 0) + (metrics?.highRiskFindings || 0);

    const tiles = useMemo(() => ({
        cpu: {
            label: "CPU utilization",
            value: loading ? "-" : `${metrics?.currentCpu || 0}%`,
            icon: Cpu,
            accent: "#1A56DB",
            sub: metrics?.cpuTrend === "stable" ? "Stable fleet" : metrics?.cpuTrend === "up" ? "Trending up" : "Trending down",
        },
        spend: {
            label: metrics?.mtdLabel || "MTD Spend",
            value: loading ? "-" : metrics?.spendLocked ? "Pro Locked" : formatSpend(metrics?.mtdSpend, metrics?.spendUnit),
            icon: Wallet,
            accent: "#F97316",
            sub: metrics?.spendLocked ? "Upgrade to unlock spend insights" : metrics?.projectedSpend ? `Projected ${formatSpend(metrics.projectedSpend, metrics?.spendUnit)}` : "Forecast pending",
        },
        resources: {
            label: "Active resources",
            value: loading ? "-" : String(metrics?.resourceCount || 0),
            icon: Boxes,
            accent: "#06B6D4",
            sub: selectedRegion,
        },
        security: {
            label: "Security status",
            value: loading ? "-" : securityIssues > 0 ? String(securityIssues) : "Secure",
            icon: ShieldCheck,
            accent: securityIssues > 0 ? "#EF4444" : "#22C55E",
            sub: securityIssues > 0 ? "Needs review" : "No active findings",
        },
    }), [loading, metrics, securityIssues, selectedRegion]);

    if (viewMode === "all") {
        return (
            <AllCloudDashboard viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        );
    }

    if (notConnected) {
        return (
            <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm dark:border-[#1E293B] dark:bg-[#050D1A] dark:text-white">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)]" />
                <div className="relative border-b border-[#E2E8F0] bg-white/80 px-5 pt-5 backdrop-blur-xl dark:border-[#1E293B] dark:bg-[#07111F]/88">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5">
                        <div>
                            <h1 className="text-xl font-extrabold tracking-tight text-[#020617] dark:text-white">
                                Command Center
                            </h1>
                        </div>
                    </div>
                    <div className="-mx-5 flex border-t border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#081220]">
                        <button
                            onClick={() => handleViewModeChange("single")}
                            className="flex items-center gap-2 px-6 py-3.5 text-sm font-extrabold transition-all border-b-2 -mb-[1px] border-[#1A56DB] text-[#1A56DB] dark:border-[#6BA3F8] dark:text-[#6BA3F8] bg-white dark:bg-[#0B1728]"
                        >
                            Single Cloud ({selectedProvider.toUpperCase()})
                        </button>
                        <button
                            onClick={() => handleViewModeChange("all")}
                            className="flex items-center gap-2 px-6 py-3.5 text-sm font-extrabold transition-all border-b-2 -mb-[1px] border-transparent text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white"
                        >
                            All Clouds (Multicloud)
                        </button>
                    </div>
                </div>
                <div className="relative flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center px-5 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] shadow-sm dark:border-[#1E3A8A] dark:bg-[#0F1E3A]">
                        <CloudIcon className="h-7 w-7 text-[#1A56DB]" />
                    </div>
                    <h2 className="mt-5 text-xl font-extrabold text-[#0F172A] dark:text-white">
                        {selectedProvider.toUpperCase()} {selectedProvider === "azure" ? "Subscription" : selectedProvider === "gcp" ? "Project" : "Account"} Not Connected
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B] dark:text-[#94A3B8]">
                        {selectedProvider === "aws" && "Deploy the CloudWatcher CloudFormation stack in your AWS account to start monitoring."}
                        {selectedProvider === "azure" && "Deploy the ARM onboarding template in your Azure subscription to start monitoring."}
                        {selectedProvider === "gcp" && "Set up the GCP service account integration in your GCP project to start monitoring."}
                    </p>
                    <Button asChild className="mt-5 bg-[#1A56DB] text-white hover:bg-[#1040A0]">
                        <Link href={selectedProvider === "aws" ? "/settings/aws" : selectedProvider === "azure" ? "/settings/azure" : "/settings/gcp"}>
                            Connect {selectedProvider.toUpperCase()} {selectedProvider === "azure" ? "Subscription" : selectedProvider === "gcp" ? "Project" : "Account"}
                        </Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm dark:border-[#1E293B] dark:bg-[#050D1A] dark:text-white">
            <div
                className="pointer-events-none absolute inset-0 dark:hidden"
                style={{
                    background:
                        "radial-gradient(circle at 8% 4%, rgba(26,86,219,0.10), transparent 26%), radial-gradient(circle at 92% 6%, rgba(249,115,22,0.10), transparent 24%), linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 46%)",
                }}
            />
            <div className="pointer-events-none absolute inset-0 hidden dark:block dark:bg-[radial-gradient(circle_at_8%_4%,rgba(59,130,246,0.16),transparent_26%),radial-gradient(circle_at_92%_6%,rgba(249,115,22,0.12),transparent_24%),linear-gradient(180deg,#07111F_0%,#050D1A_48%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)]" />

            <div className="relative border-b border-[#E2E8F0] bg-white/80 px-5 pt-5 backdrop-blur-xl dark:border-[#1E293B] dark:bg-[#07111F]/88">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between pb-5">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-xs font-bold text-[#1A56DB] shadow-sm dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
                            <Sparkles className="h-3.5 w-3.5" />
                            {selectedProvider.toUpperCase()} fusion workspace
                        </div>
                        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#020617] dark:text-white sm:text-3xl">
                            CloudWatcher Command Center
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
                            A clean {selectedProvider.toUpperCase()}-style command surface for cost, resource, security, and AI operations.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex rounded-lg border border-[#CBD5E1] bg-white p-1 shadow-sm dark:border-[#334155] dark:bg-[#0B1728]">
                            {timeRanges.map((range) => (
                                <button
                                    key={range}
                                    onClick={() => {
                                        setSelectedRange(range);
                                        setLoading(true);
                                    }}
                                    className={`h-8 rounded-md px-3 text-xs font-bold transition ${selectedRange === range
                                        ? "bg-[#1A56DB] text-white"
                                        : "text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#1A56DB] dark:text-[#94A3B8] dark:hover:bg-[#13233A] dark:hover:text-white"
                                        }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                        <CommandCenterAutoRefresh onRefresh={handleAutoRefresh} />
                        <Button
                            onClick={handleRefresh}
                            disabled={loading}
                            variant="outline"
                            className="h-10 border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1728] dark:text-white dark:hover:bg-[#13233A]"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        {lastUpdated ? (
                            <span className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold text-[#64748B] dark:border-[#334155] dark:bg-[#0B1728] dark:text-[#94A3B8]">
                                Updated {lastUpdated}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="-mx-5 flex border-t border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#081220]">
                    <button
                        onClick={() => handleViewModeChange("single")}
                        className="flex items-center gap-2 px-6 py-3.5 text-sm font-extrabold transition-all border-b-2 -mb-[1px] border-[#1A56DB] text-[#1A56DB] dark:border-[#6BA3F8] dark:text-[#6BA3F8] bg-white dark:bg-[#0B1728]"
                    >
                        Single Cloud ({selectedProvider.toUpperCase()})
                    </button>
                    <button
                        onClick={() => handleViewModeChange("all")}
                        className="flex items-center gap-2 px-6 py-3.5 text-sm font-extrabold transition-all border-b-2 -mb-[1px] border-transparent text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white"
                    >
                        All Clouds (Multicloud)
                    </button>
                </div>
            </div>

            <main className="relative p-5">
                <section
                    className="grid auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-4"
                >
                    {defaultWidgetOrder.map((widgetId) => {
                        if (["cpu", "spend", "resources", "security"].includes(widgetId)) {
                            const tile = tiles[widgetId as TileId];
                            const Icon = tile.icon;
                            return (
                                <div
                                    key={widgetId}
                                    className="min-w-0 list-none"
                                >
                                    <Card className="group min-h-[176px] gap-0 rounded-lg border-[#E2E8F0] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-[#DBEAFE] hover:shadow-[0_18px_42px_rgba(26,86,219,0.12)] dark:border-[#1E293B] dark:bg-[#0B1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)] dark:hover:border-[#1D4ED8]">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">{tile.label}</p>
                                                <p className="mt-4 truncate text-4xl font-extrabold tracking-tight text-[#020617] dark:text-white">{tile.value}</p>
                                            </div>
                                            <span className="flex h-12 w-12 shrink-0 items-center justify-center" style={{ color: tile.accent }}>
                                                <Icon className="h-8 w-8 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
                                            </span>
                                        </div>
                                        <div className="mt-auto flex items-center justify-between border-t border-[#E2E8F0] pt-4 dark:border-[#1E293B]">
                                            <span className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">{tile.sub}</span>
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tile.accent }} />
                                        </div>
                                    </Card>
                                </div>
                            );
                        }

                        if (widgetId === "telemetry") {
                            return (
                                <div
                                    key="telemetry"
                                    className="list-none md:col-span-2 xl:col-span-3"
                                >
                                    <Card className="gap-0 rounded-lg border-[#E2E8F0] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#0B1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1A56DB]">Fleet telemetry</p>
                                                <h2 className="mt-1 text-xl font-extrabold text-[#020617] dark:text-white">Utilization across AWS compute</h2>
                                            </div>
                                            <LivePulse className="mt-1" />
                                        </div>
                                        <div className="h-80 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-[#24344D] dark:bg-[#07111F]">
                                            {loading ? (
                                                <div className="flex h-full flex-col items-center justify-center gap-2 text-[#64748B]">
                                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                                    <span className="text-xs font-bold dark:text-[#94A3B8]">Loading metrics...</span>
                                                </div>
                                            ) : metrics?.cpuData && metrics.cpuData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={metrics.cpuData}>
                                                        <defs>
                                                            <linearGradient id="fleetCpu" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#1A56DB" stopOpacity={0.24} />
                                                                <stop offset="95%" stopColor="#1A56DB" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <XAxis dataKey="timestamp" hide />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748B" }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={40} />
                                                        <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E2E8F0", boxShadow: "0 12px 32px rgba(15,23,42,0.12)", fontSize: "12px" }} labelStyle={{ display: "none" }} />
                                                        <Area type="monotone" dataKey="value" stroke="#1A56DB" strokeWidth={2.5} fillOpacity={1} fill="url(#fleetCpu)" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] text-sm font-medium text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">
                                                    No telemetry data available
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            );
                        }

                        if (widgetId === "serviceMap") {
                            return (
                                <div
                                    key="serviceMap"
                                    className="list-none"
                                >
                                    <Card className="gap-0 rounded-lg border-[#E2E8F0] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-[#1E293B] dark:bg-[#0B1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
                                        <div className="mb-5 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F97316]">AWS service map</p>
                                                <h2 className="mt-1 text-xl font-extrabold text-[#020617] dark:text-white">Signals by domain</h2>
                                            </div>
                                            <Activity className="h-6 w-6 text-[#1A56DB]" />
                                        </div>
                                        <div className="space-y-3">
                                            {serviceSignals.map((signal) => (
                                                <Link key={signal.label} href={signal.label === "FinOps" ? "/dashboards/cost" : signal.label === "Security" ? "/dashboards/security" : signal.label === "Data" ? "/dashboards/rds" : "/dashboards/ec2"} className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 transition hover:border-[#DBEAFE] hover:bg-white dark:border-[#24344D] dark:bg-[#07111F] dark:hover:border-[#1D4ED8] dark:hover:bg-[#0B1728]">
                                                    <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: signal.accent }} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-extrabold text-[#0F172A] dark:text-white">{signal.label}</span>
                                                        <span className="block truncate text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{signal.value}</span>
                                                    </span>
                                                    <ArrowUpRight className="h-4 w-4 text-[#94A3B8]" />
                                                </Link>
                                            ))}
                                        </div>
                                    </Card>
                                </div>
                            );
                        }

                        const item = workflowById[widgetId as WorkflowId];
                        const Icon = item.icon;
                        const CardContent = (
                            <Card className="h-full gap-0 rounded-lg border-[#E2E8F0] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(26,86,219,0.10)] dark:border-[#1E293B] dark:bg-[#0B1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)] hover:border-[#DBEAFE] dark:hover:border-[#1D4ED8]">
                                <div className="flex items-start gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ color: item.accent }}>
                                        <Icon className="h-8 w-8 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">{item.label}</p>
                                        <h3 className="mt-1 text-base font-extrabold text-[#020617] dark:text-white">{item.title}</h3>
                                        <p className="mt-2 text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">{item.body}</p>
                                    </div>
                                </div>
                                <div className="mt-5 flex items-center justify-between border-t border-[#E2E8F0] pt-4 dark:border-[#1E293B]">
                                    {item.stat === "Live" ? (
                                        <LivePulse className="h-2.5 w-2.5" />
                                    ) : (
                                        <span className="text-sm font-extrabold text-[#1A56DB]">{item.stat}</span>
                                    )}
                                    {widgetId === "workflowSpend" ? <TrendingDown className="h-4 w-4 text-[#F97316]" /> : widgetId === "workflowAlerts" ? <AlertTriangle className="h-4 w-4 text-[#EF4444]" /> : widgetId === "workflowSimulations" ? <Rocket className="h-4 w-4 text-[#8B5CF6]" /> : <Sparkles className="h-4 w-4 text-[#1A56DB]" />}
                                </div>
                            </Card>
                        );

                        return (
                            <div
                                key={widgetId}
                                className="list-none"
                            >
                                {item.href ? (
                                    <Link href={item.href} className="block h-full no-underline">
                                        {CardContent}
                                    </Link>
                                ) : (
                                    CardContent
                                )}
                            </div>
                        );
                    })}
                </section>
            </main>
        </div>
    );
}
