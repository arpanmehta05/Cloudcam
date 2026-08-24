"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowUpRight,
    Boxes,
    CheckCircle2,
    CloudIcon,
    DollarSign,
    Filter,
    Lock,
    RefreshCw,
    ShieldCheck,
    Sparkles,
} from "@/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { getCloudBilling, getCloudConnections, getCloudInsights, getCloudResources, getCloudSecurity } from "@/lib/cloud/api";
import type { CloudProvider, CloudRegionInfo } from "@/lib/regions";
import { GLOBAL_REGION, getRegionsForProvider } from "@/lib/regions";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import type { CloudProviderConnectionSummary, NormalizedCloudResource } from "@/lib/cloud/provider-status";
import { getCloudProviderIds } from "@/lib/cloud/provider-registry";
import { SERVICE_REGISTRY } from "@/lib/services/registry";

function getServiceLabel(serviceId: string, provider: CloudProvider): string {
    const serviceConfig = SERVICE_REGISTRY[serviceId];
    if (!serviceConfig) {
        return serviceId.charAt(0).toUpperCase() + serviceId.slice(1);
    }
    if (provider === "azure" && serviceConfig.azureDisplayName) {
        return serviceConfig.azureDisplayName;
    }
    if (provider === "gcp" && serviceConfig.gcpDisplayName) {
        return serviceConfig.gcpDisplayName;
    }
    return serviceConfig.displayName;
}

const PROVIDERS: CloudProvider[] = getCloudProviderIds();
const SERVICE_FILTERS = ["all", "compute", "storage", "database", "serverless", "networking", "security"] as const;
const STATUS_FILTERS = ["all", "running", "active", "stopped", "warning", "unknown"] as const;

type ProviderFilter = CloudProvider | "all";
type ServiceFilter = (typeof SERVICE_FILTERS)[number];
type StatusFilter = (typeof STATUS_FILTERS)[number];

interface BillingSummary {
    provider: CloudProvider;
    currentSpend?: number;
    mtdSpend?: number;
    unit?: string;
    projectedTotal?: number;
}

interface SecuritySummary {
    provider: CloudProvider;
    severity?: string;
    status?: string;
    findingsCount?: number;
}

interface InsightSummary {
    provider: CloudProvider;
    id?: string;
    title?: string;
    category?: string;
    impact?: string;
    resourceId?: string;
}

function providerBadge(provider: CloudProvider) {
    const copy = getProviderCopy(provider);
    return (
        <span className="inline-flex items-center rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
            {copy.shortLabel}
        </span>
    );
}

function money(value?: number, unit = "USD"): string {
    const cleanUnit = unit === "$" ? "USD" : unit;
    try {
        const locale = cleanUnit === "INR" || cleanUnit === "₹" || cleanUnit === "Rs." ? "en-IN" : "en-US";
        const currencyCode = (cleanUnit === "₹" || cleanUnit === "Rs.") ? "INR" : cleanUnit;
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: currencyCode || "USD",
            maximumFractionDigits: 2,
        }).format(value || 0);
    } catch {
        const prefix = cleanUnit === "USD" || cleanUnit === "$" ? "$" : `${cleanUnit} `;
        return `${prefix}${(value || 0).toFixed(2)}`;
    }
}

function statusMatches(resource: NormalizedCloudResource, status: StatusFilter) {
    if (status === "all") return true;
    const current = String(resource.status || "unknown").toLowerCase();
    if (status === "unknown") return !resource.status || current === "unknown";
    return current.includes(status);
}

function serviceMatches(resource: NormalizedCloudResource, service: ServiceFilter) {
    if (service === "all") return true;
    const current = `${resource.service} ${resource.nativeType}`.toLowerCase();
    if (service === "compute") return /ec2|vm|compute|instance|lambda|function|run|container|kubernetes|eks|gke|aks/.test(current);
    if (service === "storage") return /s3|storage|bucket|disk|volume|blob/.test(current);
    if (service === "database") return /rds|sql|database|dynamo|cosmos|cloudsql|postgres|mysql/.test(current);
    if (service === "serverless") return /lambda|function|run|app service/.test(current);
    if (service === "networking") return /vpc|network|load|lb|dns|gateway|subnet/.test(current);
    if (service === "security") return /iam|security|key|defender|scc|policy/.test(current);
    return true;
}

function uniqueRegions(connections: Record<CloudProvider, CloudProviderConnectionSummary>) {
    const regions: CloudRegionInfo[] = [];
    for (const provider of PROVIDERS) {
        if (!connections[provider]?.connected) continue;
        regions.push(...getRegionsForProvider(provider));
    }
    const seen = new Set<string>();
    return regions.filter((region) => {
        if (seen.has(region.value)) return false;
        seen.add(region.value);
        return true;
    });
}

interface AllCloudDashboardProps {
    viewMode?: "single" | "all";
    onViewModeChange?: (mode: "single" | "all") => void;
}

export function AllCloudDashboard({ viewMode = "all", onViewModeChange }: AllCloudDashboardProps) {
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState("");
    const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
    const [regionFilter, setRegionFilter] = useState(GLOBAL_REGION);
    const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [connections, setConnections] = useState<Record<CloudProvider, CloudProviderConnectionSummary> | null>(null);
    const [resources, setResources] = useState<NormalizedCloudResource[]>([]);
    const [billing, setBilling] = useState<BillingSummary[]>([]);
    const [billingLocked, setBillingLocked] = useState(false);
    const [security, setSecurity] = useState<SecuritySummary[]>([]);
    const [insights, setInsights] = useState<InsightSummary[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const connectedProviders = useMemo(
        () => PROVIDERS.filter((provider) => connections?.[provider]?.connected),
        [connections]
    );
    const disconnectedProviders = useMemo(
        () => PROVIDERS.filter((provider) => connections && !connections[provider]?.connected),
        [connections]
    );
    const connectedSet = useMemo(() => new Set<CloudProvider>(connectedProviders), [connectedProviders]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [connectionsData, resourcesData, securityData, insightsData] = await Promise.all([
                getCloudConnections(),
                getCloudResources({ provider: "all", region: regionFilter }),
                getCloudSecurity({ provider: "all", region: regionFilter }),
                getCloudInsights({ provider: "all", region: regionFilter }),
            ]);

            let billingData: any = { data: [] };
            let isBillingLocked = false;
            try {
                billingData = await getCloudBilling({ provider: "all", range: "24h" });
            } catch (err: any) {
                if (err.status === 403 || err.code === "FEATURE_NOT_ENTITLED") {
                    isBillingLocked = true;
                } else {
                    throw err;
                }
            }

            setConnections(connectionsData.providers);
            setResources(resourcesData.data || []);
            setBillingLocked(isBillingLocked);
            setBilling((billingData.data || []) as unknown as BillingSummary[]);
            setSecurity((securityData.data || []) as unknown as SecuritySummary[]);
            setInsights((insightsData.data || []) as unknown as InsightSummary[]);
            setWarnings(
                [resourcesData, billingData, securityData, insightsData]
                    .flatMap((item) => item.warnings || [])
                    .filter((warning) => !String(warning).toLowerCase().includes("not connected"))
                    .filter(Boolean)
            );
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err: any) {
            console.error("Failed to load dashboard data:", err);
            setError(err.message || "Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    }, [regionFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const regions = useMemo(() => connections ? uniqueRegions(connections) : [], [connections]);

    const visibleResources = useMemo(() => resources
        .filter((resource) => connectedSet.has(resource.provider))
        .filter((resource) => providerFilter === "all" || resource.provider === providerFilter)
        .filter((resource) => regionFilter === GLOBAL_REGION || resource.region === regionFilter)
        .filter((resource) => serviceMatches(resource, serviceFilter))
        .filter((resource) => statusMatches(resource, statusFilter)), [connectedSet, providerFilter, regionFilter, resources, serviceFilter, statusFilter]);

    const visibleBilling = useMemo(() => billing
        .filter((item) => connectedSet.has(item.provider))
        .filter((item) => providerFilter === "all" || item.provider === providerFilter), [billing, connectedSet, providerFilter]);

    const visibleSecurity = useMemo(() => security
        .filter((item) => connectedSet.has(item.provider))
        .filter((item) => providerFilter === "all" || item.provider === providerFilter), [connectedSet, providerFilter, security]);

    const visibleInsights = useMemo(() => insights
        .filter((item) => connectedSet.has(item.provider))
        .filter((item) => providerFilter === "all" || item.provider === providerFilter), [connectedSet, insights, providerFilter]);

    const totalSpend = visibleBilling.reduce((sum, item) => {
        const spend = Number(item.mtdSpend ?? item.currentSpend ?? 0);
        const unit = item.unit || "USD";
        const rate = (unit === "INR" || unit === "₹" || unit === "Rs.") ? 83 : 1;
        return sum + (spend / rate);
    }, 0);
    const totalFindings = visibleSecurity.reduce((sum, item) => sum + Number(item.findingsCount || 0), 0);
    const connectedCount = connectedProviders.length;

    const providerOptions = useMemo(() => [
        { value: "all", label: "All connected" },
        ...PROVIDERS.map((provider) => ({
            value: provider,
            label: getProviderCopy(provider).shortLabel,
        })),
    ], []);

    const regionOptions = useMemo(() => [
        { value: GLOBAL_REGION, label: "All regions" },
        ...regions.map((region) => ({
            value: region.value,
            label: `${region.label} (${region.value})`,
        })),
    ], [regions]);

    const serviceOptions = useMemo(() => 
        SERVICE_FILTERS.map((service) => ({
            value: service,
            label: service === "all" ? "All services" : service.charAt(0).toUpperCase() + service.slice(1),
        }))
    , []);

    const statusOptions = useMemo(() => 
        STATUS_FILTERS.map((status) => ({
            value: status,
            label: status === "all" ? "All statuses" : status.charAt(0).toUpperCase() + status.slice(1),
        }))
    , []);

    return (
        <div className="relative overflow-hidden rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm dark:border-[#1E293B] dark:bg-[#050D1A] dark:text-white">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)]" />
            <div className="relative border-b border-[#E2E8F0] bg-white/90 px-5 pt-5 backdrop-blur-xl dark:border-[#1E293B] dark:bg-[#07111F]/90">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between pb-5">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-xs font-bold text-[#1A56DB] shadow-sm dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
                            <Sparkles className="h-3.5 w-3.5" />
                            All clouds workspace
                        </div>
                        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#020617] dark:text-white sm:text-3xl">
                            Multicloud Command Center
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
                            Aggregate connected AWS, Azure, and GCP data with provider badges, filters, and capability notes.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {lastUpdated ? (
                            <span className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold text-[#64748B] dark:border-[#334155] dark:bg-[#0B1728] dark:text-[#94A3B8]">
                                Updated {lastUpdated}
                            </span>
                        ) : null}
                        <Button onClick={loadData} disabled={loading} variant="outline" className="h-10 border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1728] dark:text-white dark:hover:bg-[#13233A]">
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {onViewModeChange && (
                    <div className="-mx-5 flex border-t border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#081220]">
                        <button
                            onClick={() => onViewModeChange("single")}
                            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-extrabold transition-all border-b-2 -mb-[1px] ${
                                viewMode === "single"
                                    ? "border-[#1A56DB] text-[#1A56DB] dark:border-[#6BA3F8] dark:text-[#6BA3F8] bg-white dark:bg-[#0B1728]"
                                    : "border-transparent text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white"
                            }`}
                        >
                            Single Cloud
                        </button>
                        <button
                            onClick={() => onViewModeChange("all")}
                            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-extrabold transition-all border-b-2 -mb-[1px] ${
                                viewMode === "all"
                                    ? "border-[#1A56DB] text-[#1A56DB] dark:border-[#6BA3F8] dark:text-[#6BA3F8] bg-white dark:bg-[#0B1728]"
                                    : "border-transparent text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white"
                            }`}
                        >
                            All Clouds (Multicloud)
                        </button>
                    </div>
                )}
            </div>

            <main className="relative space-y-5 p-5">
                {error && (
                    <div className="rounded-lg bg-red-50 p-4 border border-red-200 dark:bg-red-900/20 dark:border-red-800/30">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-red-400 dark:text-red-500" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Failed to load dashboard</h3>
                                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard icon={CloudIcon} label="Connected clouds" value={`${connectedCount}/3`} note="active providers" accent="#1A56DB" />
                    <SummaryCard icon={Boxes} label="Resources" value={loading ? "-" : String(visibleResources.length)} note="after filters" accent="#06B6D4" />
                    <SummaryCard icon={DollarSign} label="MTD spend" value={loading ? "-" : billingLocked ? "Pro Locked" : money(totalSpend)} note={billingLocked ? "Upgrade to unlock" : "connected providers"} accent="#F97316" />
                    <SummaryCard icon={ShieldCheck} label="Security findings" value={loading ? "-" : String(totalFindings)} note={`${visibleInsights.length} recommendations`} accent={totalFindings > 0 ? "#EF4444" : "#22C55E"} />
                </section>

                <Card className="relative z-10 rounded-lg border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-[#1E293B] dark:bg-[#0B1728]">
                    <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[#0F172A] dark:text-white">
                        <Filter className="h-4 w-4 text-[#1A56DB]" />
                        Filters
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <CustomDropdown
                            label="Provider"
                            options={providerOptions}
                            value={providerFilter}
                            onChange={(value) => setProviderFilter(value as ProviderFilter)}
                            searchable={false}
                        />
                        <CustomDropdown
                            label="Region"
                            options={regionOptions}
                            value={regionFilter}
                            onChange={setRegionFilter}
                            searchable={true}
                        />
                        <CustomDropdown
                            label="Service"
                            options={serviceOptions}
                            value={serviceFilter}
                            onChange={(value) => setServiceFilter(value as ServiceFilter)}
                            searchable={true}
                        />
                        <CustomDropdown
                            label="Status"
                            options={statusOptions}
                            value={statusFilter}
                            onChange={(value) => setStatusFilter(value as StatusFilter)}
                            searchable={false}
                        />
                    </div>
                </Card>

                {disconnectedProviders.length > 0 && (
                    <Card className="rounded-lg border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                        <div className="mb-3 flex items-center gap-2 text-sm font-extrabold">
                            <AlertTriangle className="h-4 w-4" />
                            Disconnected providers
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {disconnectedProviders.map((provider) => {
                                const copy = getProviderCopy(provider);
                                return (
                                    <Link key={provider} href={copy.setupHref} className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-900 transition hover:border-amber-300 dark:border-amber-500/30 dark:bg-[#0B1728] dark:text-amber-100">
                                        {copy.shortLabel} not connected
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Link>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {warnings.length > 0 && (
                    <Card className="rounded-lg border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                        <div className="mb-2 flex items-center gap-2 text-sm font-extrabold">
                            <AlertTriangle className="h-4 w-4" />
                            Provider notes
                        </div>
                        <div className="space-y-1">
                            {Array.from(new Set(warnings)).slice(0, 6).map((warning) => (
                                <p key={warning} className="text-xs font-semibold leading-5">{warning}</p>
                            ))}
                        </div>
                    </Card>
                )}

                <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                    <Card className="flex flex-col h-full rounded-lg border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-[#1E293B] dark:bg-[#0B1728]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1A56DB]">Resource inventory</p>
                                <h2 className="mt-1 text-lg font-extrabold text-[#020617] dark:text-white">Connected provider resources</h2>
                            </div>
                            <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">{visibleResources.length} rows</span>
                        </div>
                        <div className="flex-1 min-h-[460px] overflow-auto rounded-lg border border-[#E2E8F0] dark:border-[#24344D]">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="sticky top-0 bg-[#F8FAFC] text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#64748B] dark:bg-[#07111F] dark:text-[#94A3B8]">
                                    <tr>
                                        <th className="px-3 py-3">Provider</th>
                                        <th className="px-3 py-3">Resource</th>
                                        <th className="px-3 py-3">Service</th>
                                        <th className="px-3 py-3">Region</th>
                                        <th className="px-3 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#24344D]">
                                    {visibleResources.slice(0, 100).map((resource, index) => {
                                        const resolvedId = resource.id && resource.id !== "unnamed" ? resource.id : `unnamed-${index}`;
                                        const rowKey = `${resource.provider}:${resource.service}:${resolvedId}:${resource.region}`;
                                        return (
                                            <tr key={rowKey} className="bg-white dark:bg-[#0B1728]">
                                                <td className="px-3 py-3">{providerBadge(resource.provider)}</td>
                                                <td className="max-w-[260px] truncate px-3 py-3 font-bold text-[#0F172A] dark:text-white" title={resource.name}>{resource.name}</td>
                                                <td className="px-3 py-3 text-[#64748B] dark:text-[#94A3B8]">{getServiceLabel(resource.service, resource.provider)}</td>
                                                <td className="px-3 py-3 text-[#64748B] dark:text-[#94A3B8]">{resource.region}</td>
                                                <td className="px-3 py-3 text-[#64748B] dark:text-[#94A3B8]">{resource.status || "unknown"}</td>
                                            </tr>
                                        );
                                    })}
                                    {!loading && visibleResources.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-12 text-center text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">
                                                No connected resources match the current filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div className="space-y-4">
                        <Panel title="Cost summary" icon={DollarSign}>
                            {billingLocked ? (
                                <div className="flex flex-col items-center justify-center p-6 text-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] dark:border-[#24344D] dark:bg-[#07111F]">
                                    <Lock className="h-5 w-5 text-muted-foreground mb-2" />
                                    <span className="text-xs font-bold text-foreground">Pro Locked</span>
                                    <span className="text-[11px] text-muted-foreground mt-1 leading-normal mb-3">
                                        Upgrade to Pro to view cross-cloud spend analysis.
                                    </span>
                                    <Button asChild size="sm" variant="outline">
                                        <Link href="/plans">View Plans</Link>
                                    </Button>
                                </div>
                            ) : visibleBilling.length > 0 ? (
                                <div className="space-y-3">
                                    {visibleBilling.map((item) => (
                                        <div key={item.provider} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 transition-all hover:border-[#DBEAFE] dark:border-[#24344D] dark:bg-[#07111F] dark:hover:border-[#1D4ED8]">
                                            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 dark:border-[#24344D]">
                                                {providerBadge(item.provider)}
                                                <span className="text-[10px] font-extrabold text-[#64748B] dark:text-[#94A3B8]">{item.unit || "USD"}</span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">MTD Spend</span>
                                                    <span className="mt-1 block text-base font-extrabold text-[#0F172A] dark:text-white">
                                                        {money(item.mtdSpend ?? item.currentSpend, item.unit)}
                                                    </span>
                                                </div>
                                                <div className="border-l border-[#E2E8F0] pl-4 dark:border-[#24344D]">
                                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">Projected</span>
                                                    <span className="mt-1 block text-base font-extrabold text-[#1A56DB] dark:text-[#6BA3F8]">
                                                        {item.projectedTotal ? money(item.projectedTotal, item.unit) : "Pending"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyLine text="No billing data from connected providers yet." />
                            )}
                        </Panel>
                        <Panel title="Security posture" icon={ShieldCheck}>
                            {visibleSecurity.length > 0 ? visibleSecurity.map((item) => (
                                <ProviderRow key={item.provider} provider={item.provider} primary={item.status || "Unknown"} secondary={`${item.findingsCount || 0} findings | ${item.severity || "none"} severity`} />
                            )) : <EmptyLine text="No security data from connected providers yet." />}
                        </Panel>
                        <Panel title="Recommendations" icon={Sparkles}>
                            {visibleInsights.length > 0 ? visibleInsights.slice(0, 6).map((item) => (
                                <div key={`${item.provider}:${item.id || item.title}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#24344D] dark:bg-[#07111F]">
                                    <div className="mb-2">{providerBadge(item.provider)}</div>
                                    <p className="text-sm font-extrabold text-[#0F172A] dark:text-white">{item.title || "Provider recommendation"}</p>
                                    <p className="mt-1 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{item.category || "general"} | {item.impact || "impact pending"}</p>
                                </div>
                            )) : <EmptyLine text="No provider recommendations available yet." />}
                        </Panel>
                    </div>
                </section>
            </main>
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, note, accent }: { icon: any; label: string; value: string; note: string; accent: string }) {
    return (
        <Card className="min-h-[144px] rounded-lg border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0B1728]">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">{label}</p>
                    <p className="mt-3 text-3xl font-extrabold text-[#020617] dark:text-white">{value}</p>
                    <p className="mt-1 text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">{note}</p>
                </div>
                <Icon className="h-7 w-7" style={{ color: accent }} />
            </div>
        </Card>
    );
}


function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
    return (
        <Card className="rounded-lg border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-[#1E293B] dark:bg-[#0B1728]">
            <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#1A56DB]" />
                <h2 className="text-sm font-extrabold text-[#0F172A] dark:text-white">{title}</h2>
            </div>
            <div className="space-y-2">{children}</div>
        </Card>
    );
}

function ProviderRow({ provider, primary, secondary }: { provider: CloudProvider; primary: string; secondary: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#24344D] dark:bg-[#07111F]">
            <div className="min-w-0">
                {providerBadge(provider)}
                <p className="mt-2 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{secondary}</p>
            </div>
            <span className="shrink-0 text-sm font-extrabold text-[#0F172A] dark:text-white">{primary}</span>
        </div>
    );
}

function EmptyLine({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#CBD5E1] p-3 text-xs font-bold text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">
            <CheckCircle2 className="h-4 w-4" />
            {text}
        </div>
    );
}
