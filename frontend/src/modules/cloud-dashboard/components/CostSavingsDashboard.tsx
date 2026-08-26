"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth-fetch";
import { ACTION_EXECUTION_EVENT, emitActionExecutionEvent, type ActionExecutionEventDetail } from "@/lib/action-events";
import { useRegion } from "@/context/RegionContext";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import { CloudDashboardNotice } from "./CloudDashboardNotice";
import {
    ArrowDown,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    Clock,
    DollarSign,
    Loader2,
    PieChart,
    RefreshCw,
    Shield,
    Sparkles,
    Target,
    TrendingDown,
    Zap,
} from "@/icons";

interface OptimizationInsight {
    _id: string;
    resourceId: string;
    resourceName: string;
    region: string;
    type: "rightsizing" | "spot_migration" | "savings_plan" | "reserved_instance" | "orphaned_ebs" | "orphaned_rds" | "orphaned_s3";
    currentPricingModel: string;
    currentMonthlyCost: number;
    estimatedMonthlySavings: number;
    score: number;
    confidenceFactor: number;
    riskWeight: number;
    usageVarianceCoefficient: number;
    interruptionRiskScore?: number;
    azDiversity?: number;
    instanceFamilyFlexibility?: number;
    actionId: string;
    stale: boolean;
    generatedAt: string;
    metadata?: Record<string, any>;
}

interface PricingBreakdown {
    breakdown: { onDemand: number; reserved: number; spot: number; savingsPlan: number; other: number; total: number };
    percentages: { onDemand: number; reserved: number; spot: number; savingsPlan: number };
}

interface OptimizationData {
    insights: OptimizationInsight[];
    pricingBreakdown: PricingBreakdown;
    totalPotentialSavings: number;
    generatedAt: string;
    fromCache: boolean;
}

interface SavingsRecord {
    _id: string;
    actionRequestId: string;
    actionId: string;
    service: string;
    estimatedMonthlySavings: number;
    actualMonthlySavings?: number;
    actualSavings?: number;
    verifiedAt?: string;
    realizedAt?: string;
    createdAt?: string;
}

interface SavingsData {
    records: SavingsRecord[];
    totalEstimatedMonthlySavings: number;
    totalActualSavings: number;
    recordCount: number;
    verifiedCount?: number;
    avgRealizationRatio?: number;
}

interface NoticeState {
    type: "success" | "warning" | "error";
    title: string;
    message: string;
}

const typeLabels: Record<string, string> = {
    rightsizing: "Right-sizing",
    spot_migration: "Spot migration",
    savings_plan: "Savings plan",
    reserved_instance: "Reserved instance",
    orphaned_ebs: "Unattached EBS",
    orphaned_rds: "Stale RDS snapshot",
    orphaned_s3: "Old S3 bucket",
};

const typeColors: Record<string, string> = {
    rightsizing: "bg-blue-50 text-blue-700 border-blue-200",
    spot_migration: "bg-amber-50 text-amber-700 border-amber-200",
    savings_plan: "bg-emerald-50 text-emerald-700 border-emerald-200",
    reserved_instance: "bg-cyan-50 text-cyan-700 border-cyan-200",
    orphaned_ebs: "bg-rose-50 text-rose-700 border-rose-200",
    orphaned_rds: "bg-rose-50 text-rose-700 border-rose-200",
    orphaned_s3: "bg-rose-50 text-rose-700 border-rose-200",
};

const serviceColors: Record<string, string> = {
    ec2: "bg-orange-50 text-orange-700 border-orange-200",
    rds: "bg-blue-50 text-blue-700 border-blue-200",
    lambda: "bg-purple-50 text-purple-700 border-purple-200",
    s3: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ebs: "bg-slate-50 text-slate-700 border-slate-200",
    billing: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const pricingColors: Record<string, string> = {
    onDemand: "#f97316",
    reserved: "#2563eb",
    spot: "#eab308",
    savingsPlan: "#10b981",
};

const riskLevelByActionId: Record<string, "low" | "medium" | "high" | "critical"> = {
    "ec2-stop-idle": "low",
    "purchase-savings-plan": "low",
    "ec2-stop": "medium",
    "rds-stop": "medium",
    "ebs-delete": "medium",
    "rds-delete-snapshot": "medium",
    "asg-spot-migration": "medium",
    "ec2-rightsize": "high",
    "rds-resize": "high",
    "lambda-optimize": "high",
    "s3-delete-bucket": "high",
    "ec2-terminate": "critical",
};

const ADVISORY_ACTION_IDS = new Set(["purchase-savings-plan"]);

function money(value: number | undefined) {
    return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(dateStr: string): string {
    const stamp = new Date(dateStr).getTime();
    if (!Number.isFinite(stamp)) return "unknown";
    const diff = Date.now() - stamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function scoreStyle(score: number): string {
    if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (score >= 50) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-rose-700 bg-rose-50 border-rose-200";
}

function scoreLabel(score: number): string {
    if (score >= 80) return "High confidence";
    if (score >= 50) return "Moderate";
    return "Low confidence";
}

async function requestJson<T = any>(url: string, options?: RequestInit): Promise<T> {
    const response = await authFetch(url, options);
    return response.json() as Promise<T>;
}

function isBucketNotEmptyMessage(message?: string): boolean {
    const text = (message || "").toLowerCase();
    return text.includes("bucket") && text.includes("not empty");
}

function insightDetails(insight: OptimizationInsight): string {
    const parts = [insight.resourceId];
    if (insight.metadata?.currentType) parts.push(String(insight.metadata.currentType));
    if (insight.metadata?.recommendedType) parts.push(`to ${String(insight.metadata.recommendedType)}`);
    if (insight.type === "orphaned_ebs" && insight.metadata?.size !== undefined) {
        parts.push(`${String(insight.metadata.size)} GB ${String(insight.metadata.volumeType || "volume")}`);
    }
    if (insight.type === "orphaned_rds" && insight.metadata?.ageDays !== undefined) {
        parts.push(`${String(insight.metadata.ageDays)} days old`);
    }
    if (insight.type === "orphaned_s3" && insight.metadata?.ageDays !== undefined) {
        parts.push(`unmodified for ${String(insight.metadata.ageDays)} days`);
    }
    return parts.join(" | ");
}

export function CostSavingsDashboard() {
    const { selectedProvider, selectedRegion } = useRegion();
    const providerCopy = getProviderCopy(selectedProvider);
    const isAwsProvider = selectedProvider === "aws";
    const [activeTab, setActiveTab] = useState<"opportunities" | "history">("opportunities");
    const [optData, setOptData] = useState<OptimizationData | null>(null);
    const [savings, setSavings] = useState<SavingsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingsLoading, setIsSavingsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savingsError, setSavingsError] = useState<string | null>(null);
    const [notice, setNotice] = useState<NoticeState | null>(null);
    const [workingInsightId, setWorkingInsightId] = useState<string | null>(null);
    const [actionPhase, setActionPhase] = useState<"validating" | "executing" | null>(null);
    const [forceDeleteCandidate, setForceDeleteCandidate] = useState<OptimizationInsight | null>(null);
    const [forceDeleteText, setForceDeleteText] = useState("");
    const [savingsRecord, setSavingsRecord] = useState<SavingsRecord | null>(null);
    const [actualSavingsInput, setActualSavingsInput] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [verifyingSavingsId, setVerifyingSavingsId] = useState<string | null>(null);

    const pricingBars = optData?.pricingBreakdown?.percentages;
    const totalPct = pricingBars
        ? pricingBars.onDemand + pricingBars.reserved + pricingBars.spot + pricingBars.savingsPlan
        : 0;

    const visibleInsights = useMemo(() => optData?.insights || [], [optData]);

    const fetchSavings = useCallback(async () => {
        setSavingsError(null);
        setIsSavingsLoading(true);
        try {
            const data = await requestJson<{ success: boolean; savings: SavingsData; error?: string }>("/api/aws/actions/savings?limit=100");
            if (!data.success) throw new Error(data.error || "Failed to load savings history");
            setSavings(data.savings);
        } catch (err: any) {
            setSavingsError(err?.message || "Failed to load savings history");
        } finally {
            setIsSavingsLoading(false);
        }
    }, []);

    const fetchOptimization = useCallback(async (force = false) => {
        if (!isAwsProvider) {
            setOptData(null);
            setError(null);
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }
        if (force) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);
        try {
            const url = force
                ? `/api/aws/optimization/refresh?region=${encodeURIComponent(selectedRegion)}`
                : `/api/aws/optimization?region=${encodeURIComponent(selectedRegion)}`;
            const data = await requestJson<{ success: boolean; data: OptimizationData; error?: string }>(url, {
                method: force ? "POST" : "GET",
            });
            if (!data.success) throw new Error(data.error || "Failed to fetch optimization data");
            setOptData(data.data);
        } catch (err: any) {
            setError(err?.message || "Failed to connect to optimization service");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [isAwsProvider, selectedRegion]);

    const refreshRouteData = useCallback(async (forceOptimization = false) => {
        await Promise.all([fetchSavings(), fetchOptimization(forceOptimization)]);
    }, [fetchOptimization, fetchSavings]);

    useEffect(() => {
        fetchOptimization(false);
        fetchSavings();
    }, [fetchOptimization, fetchSavings]);

    useEffect(() => {
        const onActionEvent = (event: Event) => {
            const detail = (event as CustomEvent<ActionExecutionEventDetail>).detail;
            if (detail?.source === "cost-savings") return;
            refreshRouteData(true);
        };

        window.addEventListener(ACTION_EXECUTION_EVENT, onActionEvent);
        return () => window.removeEventListener(ACTION_EXECUTION_EVENT, onActionEvent);
    }, [refreshRouteData]);

    async function handleValidateAndExecute(insight: OptimizationInsight, options?: { forceEmptyDelete?: boolean }) {
        const forceEmptyDelete = !!options?.forceEmptyDelete;
        setWorkingInsightId(insight._id);
        setActionPhase("validating");
        setNotice(null);

        if (ADVISORY_ACTION_IDS.has(insight.actionId)) {
            setNotice({
                type: "warning",
                title: "Advisory recommendation",
                message: "Savings Plan and Reserved Instance recommendations are advisory. Complete the purchase in AWS Cost Management after reviewing commitment terms.",
            });
            setWorkingInsightId(null);
            setActionPhase(null);
            return;
        }

        try {
            const validateData = await requestJson<{ success: boolean; validation?: { valid: boolean; reason?: string }; error?: string }>(
                `/api/aws/optimization/validate/${insight._id}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ forceEmptyDelete }),
                }
            );

            if (!validateData.validation?.valid) {
                const reason = validateData.validation?.reason || validateData.error || "Validation failed";
                if (insight.actionId === "s3-delete-bucket" && isBucketNotEmptyMessage(reason) && !forceEmptyDelete) {
                    setForceDeleteCandidate(insight);
                    setForceDeleteText("");
                    setNotice({
                        type: "warning",
                        title: "Bucket is not empty",
                        message: "Cloudcam blocked the delete. You can force empty and delete only after confirming the irreversible data removal.",
                    });
                    return;
                }
                setNotice({ type: "warning", title: "Action blocked", message: `${insight.resourceName}: ${reason}` });
                return;
            }

            const target: Record<string, string> = {
                resourceId: insight.resourceId,
                resourceName: insight.resourceName || insight.resourceId,
                region: insight.region || selectedRegion || "us-east-1",
            };
            if (insight.actionId === "ec2-rightsize" && insight.metadata?.recommendedType) {
                target.proposedState = String(insight.metadata.recommendedType);
            }
            if (insight.actionId === "s3-delete-bucket" && forceEmptyDelete) {
                target.proposedState = "force-empty-delete";
            }

            setActionPhase("executing");
            const plan = {
                actionId: insight.actionId,
                targets: [target],
                estimatedSavings: insight.estimatedMonthlySavings,
                riskLevel: riskLevelByActionId[insight.actionId] || "medium",
                reasoning: `Execute deterministic optimization insight ${insight._id} for ${insight.resourceName || insight.resourceId}`,
                warnings: [
                    ...(insight.stale ? ["Insight may be stale. Revalidated immediately before execution."] : []),
                    ...(forceEmptyDelete ? ["Force-empty-delete enabled: all objects, versions, and delete markers will be permanently removed."] : []),
                ],
            };

            const createData = await requestJson<{ success: boolean; actionRequest?: { _id?: string }; error?: string }>("/api/aws/actions/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, simulationMode: false }),
            });
            const actionRequestId = createData.actionRequest?._id;
            if (!createData.success || !actionRequestId) throw new Error(createData.error || "Action request was not created");

            await requestJson(`/api/aws/actions/approve/${actionRequestId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ simulationMode: false }),
            });

            const executeData = await requestJson<{ success: boolean; actionRequest?: { status?: string }; error?: string }>(
                `/api/aws/actions/execute/${actionRequestId}`,
                { method: "POST" }
            );
            const status = executeData.actionRequest?.status || "completed";
            emitActionExecutionEvent({ actionRequestId, actionId: insight.actionId, status, source: "cost-savings" });

            setNotice({
                type: "success",
                title: "Action completed",
                message: forceEmptyDelete
                    ? `Force empty and delete completed for ${insight.resourceName}. Status: ${status}.`
                    : `Validated and executed ${insight.actionId} for ${insight.resourceName}. Status: ${status}.`,
            });
            await refreshRouteData(true);
        } catch (err: any) {
            const targetFailure = err?.details?.targetErrors?.[0]?.error;
            const message = targetFailure || err?.message || "Failed to validate and execute action";
            if (insight.actionId === "s3-delete-bucket" && isBucketNotEmptyMessage(message) && !forceEmptyDelete) {
                setForceDeleteCandidate(insight);
                setForceDeleteText("");
            }
            emitActionExecutionEvent({ actionId: insight.actionId, status: "failed", message, source: "cost-savings" });
            setNotice({ type: "error", title: "Action failed", message });
        } finally {
            setWorkingInsightId(null);
            setActionPhase(null);
        }
    }

    async function submitForceDelete() {
        if (!forceDeleteCandidate) return;
        const expected = `FORCE DELETE ${forceDeleteCandidate.resourceId}`;
        if (forceDeleteText.trim() !== expected) {
            setFormError(`Type exactly: ${expected}`);
            return;
        }
        setFormError(null);
        const candidate = forceDeleteCandidate;
        setForceDeleteCandidate(null);
        setForceDeleteText("");
        await handleValidateAndExecute(candidate, { forceEmptyDelete: true });
    }

    function openSavingsModal(record: SavingsRecord) {
        const suggested = record.actualMonthlySavings ?? record.actualSavings ?? record.estimatedMonthlySavings;
        setSavingsRecord(record);
        setActualSavingsInput(String(Number(suggested || 0).toFixed(2)));
        setFormError(null);
    }

    async function submitActualSavings() {
        if (!savingsRecord) return;
        const actual = Number.parseFloat(actualSavingsInput);
        if (!Number.isFinite(actual) || actual < 0) {
            setFormError("Enter a valid non-negative amount.");
            return;
        }

        setVerifyingSavingsId(savingsRecord._id);
        setFormError(null);
        try {
            const data = await requestJson<{ success: boolean; error?: string }>("/api/aws/actions/savings/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    actionRequestId: savingsRecord.actionRequestId,
                    actualMonthlySavings: actual,
                }),
            });
            if (!data.success) throw new Error(data.error || "Failed to save realized savings");
            setNotice({ type: "success", title: "Savings recorded", message: `Actual monthly savings saved as ${money(actual)}.` });
            setSavingsRecord(null);
            await refreshRouteData(true);
        } catch (err: any) {
            setFormError(err?.message || "Failed to save realized savings");
        } finally {
            setVerifyingSavingsId(null);
        }
    }

    if (!isAwsProvider) {
        return (
            <div className="space-y-5" data-inner-route>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#020617] dark:text-white">
                            Cost Optimization
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Prioritize {providerCopy.shortLabel} savings opportunities, execute approved actions, and measure realized impact.
                        </p>
                    </div>
                </div>
                <Card className="flex flex-col items-center justify-center p-12 text-center border-[#E2E8F0] bg-white shadow-sm dark:border-[#1E293B] dark:bg-[#0B1728]">
                    <Sparkles className="mb-3 h-8 w-8 text-[#1A56DB] dark:text-[#6BA3F8] animate-pulse" />
                    <p className="text-sm font-medium">{providerCopy.shortLabel} cost optimization is not wired yet</p>
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                        Cloudcam will use real {providerCopy.shortLabel} billing, inventory, and recommendation signals here when this provider capability is implemented. For now, the page is intentionally blocked so it does not show AWS recommendations for a {providerCopy.accountName}.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-5" data-inner-route>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#020617] dark:text-white">
                        Cost Optimization
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Prioritize {providerCopy.shortLabel} savings opportunities, execute approved actions, and measure realized impact.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {optData?.generatedAt && (
                        <span className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {optData.fromCache ? "Cached" : "Fresh"} | {timeAgo(optData.generatedAt)}
                        </span>
                    )}
                    <Button onClick={() => fetchOptimization(true)} disabled={isRefreshing} size="sm">
                        {isRefreshing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                        Refresh
                    </Button>
                </div>
            </div>

            {notice && (
                <CloudDashboardNotice
                    variant={notice.type}
                    title={notice.title}
                    message={notice.message}
                />
            )}

            {error && (
                <CloudDashboardNotice
                    variant="error"
                    icon={null}
                    message={error}
                    actions={
                        <Button size="sm" variant="outline" onClick={() => fetchOptimization(true)} disabled={isRefreshing}>
                            Retry analysis
                        </Button>
                    }
                />
            )}

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "opportunities" | "history")}>
                <TabsList variant="line" className="w-full justify-start border-b pb-0">
                    <TabsTrigger value="opportunities" className="gap-1.5">
                        <Target className="h-4 w-4" />
                        Opportunities
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5">
                        <BarChart3 className="h-4 w-4" />
                        Savings History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="opportunities" className="mt-5">
                    {isLoading && !optData ? (
                        <Card className="flex flex-col items-center justify-center p-12 text-center">
                            <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
                            <p className="text-sm font-medium">Analyzing optimization data</p>
                            <p className="mt-1 max-w-md text-xs text-muted-foreground">
                                Cloudcam is reading billing, inventory, and recommendation signals for the selected region.
                            </p>
                        </Card>
                    ) : optData ? (
                        <div className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <SummaryCard icon={<TrendingDown className="h-4 w-4" />} label="Potential Monthly Savings" value={money(optData.totalPotentialSavings)} note={`${money(optData.totalPotentialSavings * 12)}/year`} highlight />
                                <SummaryCard icon={<DollarSign className="h-4 w-4 text-emerald-600" />} label="Recorded Actual Savings" value={money(savings?.totalActualSavings)} note={`${savings?.verifiedCount || 0} verified record${(savings?.verifiedCount || 0) === 1 ? "" : "s"}`} />
                                <SummaryCard icon={<Zap className="h-4 w-4" />} label="Open Opportunities" value={String(visibleInsights.length)} note={`Region: ${selectedRegion}`} />
                                <SummaryCard icon={<Shield className="h-4 w-4" />} label="Realization Ratio" value={`${Math.round((savings?.avgRealizationRatio || 0) * 100)}%`} note="Actual vs estimated feedback" />
                            </div>

                            {pricingBars && totalPct > 0 && (
                                <Card className="p-4">
                                    <div className="mb-4 flex items-center gap-2">
                                        <PieChart className="h-4 w-4 text-muted-foreground" />
                                        <h2 className="text-sm font-semibold">Spend by pricing model</h2>
                                    </div>
                                    <div className="mb-4 flex h-5 overflow-hidden rounded-md bg-secondary">
                                        {([
                                            ["onDemand", pricingBars.onDemand],
                                            ["reserved", pricingBars.reserved],
                                            ["spot", pricingBars.spot],
                                            ["savingsPlan", pricingBars.savingsPlan],
                                        ] as const).map(([key, pct]) => pct > 0 ? (
                                            <div key={key} className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: pricingColors[key] }} />
                                        ) : null)}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {([
                                            ["On-Demand", pricingBars.onDemand, optData.pricingBreakdown.breakdown.onDemand, pricingColors.onDemand],
                                            ["Reserved", pricingBars.reserved, optData.pricingBreakdown.breakdown.reserved, pricingColors.reserved],
                                            ["Spot", pricingBars.spot, optData.pricingBreakdown.breakdown.spot, pricingColors.spot],
                                            ["Savings Plan", pricingBars.savingsPlan, optData.pricingBreakdown.breakdown.savingsPlan, pricingColors.savingsPlan],
                                        ] as [string, number, number, string][]).map(([label, pct, amount, color]) => (
                                            <div key={label} className="flex items-center gap-2 rounded-md border border-border bg-card p-3">
                                                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold">{label}</p>
                                                    <p className="text-xs text-muted-foreground">{pct}% | {money(amount)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold">Recommendations ({visibleInsights.length})</h2>
                                    {isRefreshing && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Refreshing</span>}
                                </div>

                                {visibleInsights.length === 0 ? (
                                    <Card className="p-12 text-center">
                                        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
                                        <p className="text-sm font-medium">No savings opportunities found</p>
                                        <p className="mt-1 text-sm text-muted-foreground">The selected region does not currently show actionable optimization findings.</p>
                                    </Card>
                                ) : (
                                    <div className="grid gap-3">
                                        {visibleInsights.map((insight) => {
                                            const isWorking = workingInsightId === insight._id;
                                            return (
                                                <Card key={insight._id} className="p-4 transition-colors hover:bg-secondary/30">
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline" className={`text-[10px] ${typeColors[insight.type] || "bg-secondary text-muted-foreground"}`}>
                                                                    {typeLabels[insight.type] || insight.type}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">{insight.region}</span>
                                                                {insight.stale && <Badge variant="destructive" className="text-[10px]">Stale</Badge>}
                                                                {ADVISORY_ACTION_IDS.has(insight.actionId) && <Badge variant="secondary" className="text-[10px]">Advisory</Badge>}
                                                            </div>
                                                            <p className="truncate text-sm font-semibold">{insight.resourceName || insight.resourceId}</p>
                                                            <p className="mt-1 break-all text-xs text-muted-foreground">{insightDetails(insight)}</p>
                                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${scoreStyle(insight.score)}`}>
                                                                    <Shield className="h-3 w-3" />
                                                                    {scoreLabel(insight.score)} | {insight.score.toFixed(1)}
                                                                </span>
                                                                <span className="text-[11px] text-muted-foreground">Confidence {(insight.confidenceFactor * 100).toFixed(0)}%</span>
                                                                <span className="text-[11px] text-muted-foreground">Risk {insight.riskWeight.toFixed(1)}x</span>
                                                                {insight.interruptionRiskScore != null && <span className="text-[11px] text-muted-foreground">Interrupt {(insight.interruptionRiskScore * 100).toFixed(0)}%</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 items-end justify-between gap-3 lg:flex-col">
                                                            <div className="text-left lg:text-right">
                                                                <p className="text-lg font-extrabold text-emerald-600">{money(insight.estimatedMonthlySavings)}</p>
                                                                <p className="text-[11px] text-muted-foreground">per month</p>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant={ADVISORY_ACTION_IDS.has(insight.actionId) ? "outline" : "default"}
                                                                disabled={isWorking || insight.stale}
                                                                onClick={() => handleValidateAndExecute(insight)}
                                                            >
                                                                {isWorking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="mr-1.5 h-3.5 w-3.5" />}
                                                                {isWorking ? (actionPhase === "executing" ? "Executing" : "Validating") : ADVISORY_ACTION_IDS.has(insight.actionId) ? "View guidance" : "Validate & Execute"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : !error ? (
                        <Card className="p-12 text-center">
                            <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm font-medium">No analysis loaded</p>
                            <p className="mt-1 text-sm text-muted-foreground">Run an analysis for the selected region to find savings opportunities.</p>
                            <Button className="mt-4" size="sm" onClick={() => fetchOptimization(true)}>Analyze now</Button>
                        </Card>
                    ) : null}
                </TabsContent>

                <TabsContent value="history" className="mt-5">
                    <div className="space-y-5">
                        {savingsError && <CloudDashboardNotice variant="error" icon={null} message={savingsError} />}
                        {isSavingsLoading && !savings ? (
                            <Card className="flex flex-col items-center justify-center p-12 text-center">
                                <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
                                <p className="text-sm font-medium">Loading savings history</p>
                            </Card>
                        ) : savings ? (
                            <>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <SummaryCard icon={<TrendingDown className="h-4 w-4" />} label="Estimated Monthly Savings" value={money(savings.totalEstimatedMonthlySavings)} note={`${money(savings.totalEstimatedMonthlySavings * 12)}/year`} highlight />
                                    <SummaryCard icon={<DollarSign className="h-4 w-4 text-emerald-600" />} label="Actual Monthly Savings" value={money(savings.totalActualSavings)} note="Recorded from feedback" />
                                    <SummaryCard icon={<Zap className="h-4 w-4" />} label="Completed Actions" value={String(savings.recordCount)} note={`${savings.verifiedCount || 0} verified`} />
                                </div>

                                {savings.records.length === 0 ? (
                                    <Card className="p-12 text-center">
                                        <ArrowDown className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                                        <p className="text-sm font-medium">No savings recorded yet</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Execute optimization actions to start tracking estimated and actual savings.</p>
                                    </Card>
                                ) : (
                                    <div className="grid gap-3">
                                        {savings.records.map((record) => (
                                            <Card key={record._id} className="p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <Badge variant="outline" className={`text-[10px] ${serviceColors[record.service] || "bg-secondary text-muted-foreground"}`}>
                                                            {record.service.toUpperCase()}
                                                        </Badge>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold">{record.actionId}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {new Date(record.verifiedAt || record.realizedAt || record.createdAt || Date.now()).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                                                        <div className="text-left sm:text-right">
                                                            <p className="text-sm font-semibold text-emerald-600">{money(record.estimatedMonthlySavings)}/mo</p>
                                                            {(record.actualMonthlySavings ?? record.actualSavings ?? 0) > 0 && (
                                                                <p className="text-xs text-muted-foreground">Actual {money(record.actualMonthlySavings ?? record.actualSavings)}</p>
                                                            )}
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={verifyingSavingsId === record._id}
                                                            onClick={() => openSavingsModal(record)}
                                                        >
                                                            {verifyingSavingsId === record._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Record actual"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={!!forceDeleteCandidate} onOpenChange={(open) => {
                if (!open) {
                    setForceDeleteCandidate(null);
                    setForceDeleteText("");
                    setFormError(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Force empty and delete bucket</DialogTitle>
                        <DialogDescription>
                            This permanently removes all objects, versions, and delete markers before deleting the bucket. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {forceDeleteCandidate && (
                        <div className="space-y-3">
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                Bucket: <span className="font-semibold">{forceDeleteCandidate.resourceId}</span>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="force-delete-confirm">Confirmation text</Label>
                                <Input
                                    id="force-delete-confirm"
                                    value={forceDeleteText}
                                    onChange={(event) => setForceDeleteText(event.target.value)}
                                    placeholder={`FORCE DELETE ${forceDeleteCandidate.resourceId}`}
                                />
                                {formError && <p className="text-xs text-destructive">{formError}</p>}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForceDeleteCandidate(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={submitForceDelete} disabled={!!workingInsightId}>Force delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!savingsRecord} onOpenChange={(open) => {
                if (!open) {
                    setSavingsRecord(null);
                    setActualSavingsInput("");
                    setFormError(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record actual savings</DialogTitle>
                        <DialogDescription>
                            Enter the realized monthly savings. Cloudcam uses this feedback to calibrate future recommendations.
                        </DialogDescription>
                    </DialogHeader>
                    {savingsRecord && (
                        <div className="space-y-3">
                            <div className="rounded-md border border-border bg-secondary/50 p-3 text-sm">
                                <p className="font-semibold">{savingsRecord.actionId}</p>
                                <p className="text-muted-foreground">Estimated {money(savingsRecord.estimatedMonthlySavings)} per month</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="actual-savings">Actual monthly savings (USD)</Label>
                                <Input
                                    id="actual-savings"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={actualSavingsInput}
                                    onChange={(event) => setActualSavingsInput(event.target.value)}
                                />
                                {formError && <p className="text-xs text-destructive">{formError}</p>}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSavingsRecord(null)}>Cancel</Button>
                        <Button onClick={submitActualSavings} disabled={!!verifyingSavingsId}>
                            {verifyingSavingsId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            Save savings
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SummaryCard({
    icon,
    label,
    value,
    note,
    highlight = false,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    note: string;
    highlight?: boolean;
}) {
    return (
        <Card className={`p-4 ${highlight ? "border-blue-200 bg-blue-50/70 dark:bg-blue-950/20" : ""}`}>
            <div className="mb-2 flex items-center gap-2">
                {icon}
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </Card>
    );
}
