"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionPreviewDrawer } from "@/components/ActionPreviewDrawer";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import {
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Wallet,
  Boxes,
  ShieldCheck,
  ArrowUpRight,
  Zap,
} from "@/icons";
import { useRecommendations } from "./Recommendations/useRecommendations";
import { RecommendationCard } from "./Recommendations/RecommendationCard";
import { RecFilters } from "./Recommendations/RecFilters";
import { StatusSidebar } from "./Recommendations/StatusSidebar";
import { money } from "./Recommendations/helpers";
import { CloudDashboardNotice } from "./CloudDashboardNotice";

export function RecommendationsDashboard() {
  const {
    insights, metrics, error, lastUpdated, providerFilter, setProviderFilter,
    actionDrawerOpen, setActionDrawerOpen, selectedAction, setSelectedAction,
    planningRec, loading, handleRefresh, handleDismiss, handleRestoreDismissed,
    handleImplementPlan, handlePlanAction, visibleRecommendations,
    dismissedRecommendations, visibleOptimizations, visibleDiagnosis,
    connectedProviders, disconnectedProviders, totalCurrencySavings, totalSpend,
    spendUnit, resourceCount, findingCount, PROVIDERS, syncInProgress,
  } = useRecommendations();

  const summaryCards = [
    {
      label: "Estimated savings",
      value: money(totalCurrencySavings, spendUnit),
      sub: "verified monthly",
      icon: TrendingUp,
      accent: "#22C55E",
    },
    {
      label: "MTD spend",
      value: money(totalSpend, spendUnit),
      sub: "connected clouds",
      icon: Wallet,
      accent: "#F97316",
    },
    {
      label: "Resources",
      value: String(resourceCount),
      sub: "active inventory",
      icon: Boxes,
      accent: "#06B6D4",
    },
    {
      label: "Security findings",
      value: String(findingCount),
      sub: "all providers",
      icon: ShieldCheck,
      accent: findingCount > 0 ? "#EF4444" : "#22C55E",
    },
  ];

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-[#E2E8F0] bg-white/88 p-5 shadow-sm backdrop-blur-xl dark:border-[#1E293B] dark:bg-[#07111F]/88">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-xs font-extrabold text-[#1A56DB] shadow-sm dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
              <Sparkles className="h-3.5 w-3.5" />
              Multicloud intelligence hub
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#020617] dark:text-white">
              Recommendations
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
              Cost, reliability, security, and provider-native recommendations across AWS, Azure, and GCP.
              {insights && !loading && (
                <span className="ml-2 font-bold text-[#1A56DB] dark:text-[#6BA3F8]">
                  {visibleRecommendations.length} active in view
                </span>
              )}
              {syncInProgress && (
                <span className="ml-2 inline-flex items-center gap-1 font-bold text-[#D97706] dark:text-[#FBBF24]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating AI insights...
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated && (
              <span className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#64748B] dark:border-[#334155] dark:bg-[#0B1728] dark:text-[#94A3B8]">
                Updated {lastUpdated}
              </span>
            )}
            <Button onClick={handleRefresh} disabled={loading} className="h-10">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {loading && insights ? "Refreshing" : insights ? "Refresh" : "Analyze"}
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <CloudDashboardNotice
          variant="error"
          icon={null}
          message={error}
          className="border-[#FCA5A5] bg-[#FEF2F2] text-sm font-semibold text-[#B91C1C] dark:border-[#7F1D1D] dark:bg-[#3B1218] dark:text-[#FCA5A5]"
        />
      )}

      {insights && (
        <RecFilters
          providerFilter={providerFilter}
          setProviderFilter={setProviderFilter}
          providers={PROVIDERS}
        />
      )}

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="min-h-[144px] gap-0 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">
                      {card.label}
                    </p>
                    <p className="mt-4 text-3xl font-extrabold tracking-tight text-[#020617] dark:text-white">
                      {card.value}
                    </p>
                  </div>
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                    style={{ color: card.accent }}
                  >
                    <Icon className="h-7 w-7 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
                  </span>
                </div>
                <p className="mt-auto border-t border-[#E2E8F0] pt-4 text-sm font-bold text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
                  {card.sub}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {loading && !insights && (
        <Card className="flex min-h-72 items-center justify-center gap-3 p-8 text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
          <Loader2 className="h-5 w-5 animate-spin text-[#1A56DB]" />
          Analyzing connected providers...
        </Card>
      )}

      {!insights && !loading && !error && (
        <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-[#020617] dark:text-white">
            Generate multicloud intelligence
          </h2>
          <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
            Analyze connected AWS, Azure, and GCP environments to uncover savings, reliability issues, security findings, and provider-native improvements.
          </p>
          <Button onClick={handleRefresh} className="mt-5">
            <Zap className="h-4 w-4" />
            Run analysis
          </Button>
        </Card>
      )}

      {insights && (
        <>
          {disconnectedProviders.length > 0 && (
            <CloudDashboardNotice
              variant="warning"
              icon={null}
              className="rounded-lg border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-extrabold">
                <AlertTriangle className="h-4 w-4" />
                Disconnected providers
              </div>
              <div className="flex flex-wrap gap-2">
                {disconnectedProviders.map((provider) => {
                  const copy = getProviderCopy(provider);
                  return (
                    <Link
                      key={provider}
                      href={copy.setupHref}
                      className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-900 transition hover:border-amber-300 dark:border-amber-500/30 dark:bg-[#0B1728] dark:text-amber-100"
                    >
                      {copy.shortLabel} not connected
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  );
                })}
              </div>
            </CloudDashboardNotice>
          )}



          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-[#020617] dark:text-white">
                    Action queue
                  </h2>
                  <p className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
                    {visibleRecommendations.length} active recommendations across{" "}
                    {providerFilter === "all"
                      ? `${connectedProviders.length || 0} connected clouds`
                      : getProviderCopy(providerFilter).shortLabel}
                  </p>
                </div>
                <Badge variant="secondary">{dismissedRecommendations.length} dismissed</Badge>
              </div>

              {visibleRecommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  planningRec={planningRec}
                  handlePlanAction={handlePlanAction}
                  handleImplementPlan={handleImplementPlan}
                  handleDismiss={handleDismiss}
                />
              ))}

              {visibleRecommendations.length === 0 && (
                <Card className="flex min-h-44 flex-col items-center justify-center p-6 text-center">
                  <CheckCircle className="h-9 w-9 text-[#22C55E]" />
                  <p className="mt-3 text-sm font-extrabold text-[#0F172A] dark:text-white">
                    No pending recommendations
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    The selected provider scope is clear.
                  </p>
                </Card>
              )}

              {dismissedRecommendations.length > 0 && (
                <Card className="border-[#E2E8F0] bg-white p-4 dark:border-[#24344D] dark:bg-[#07111F]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#0F172A] dark:text-white">
                        Dismissed
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                        Hidden recommendations for the current session.
                      </p>
                    </div>
                    <Badge variant="secondary">{dismissedRecommendations.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {dismissedRecommendations.map((rec) => (
                      <div
                        key={rec.id}
                        className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#24344D] dark:bg-[#0B1728]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
                                {getProviderCopy(rec.provider).shortLabel}
                              </span>
                              <p className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                                {rec.title}
                              </p>
                            </div>
                            <p className="line-clamp-2 text-xs font-medium leading-5 text-[#64748B] dark:text-[#94A3B8]">
                              {rec.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestoreDismissed(rec.id)}
                          >
                            Restore
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </section>

            <StatusSidebar
              visibleDiagnosis={visibleDiagnosis}
              visibleOptimizations={visibleOptimizations}
            />
          </div>
        </>
      )}

      {selectedAction && (
        <ActionPreviewDrawer
          isOpen={actionDrawerOpen}
          onClose={() => {
            setActionDrawerOpen(false);
            setSelectedAction(null);
          }}
          actionId={selectedAction.actionId}
          targets={selectedAction.targets}
          estimatedSavings={selectedAction.estimatedSavings}
          reasoning={selectedAction.reasoning}
          onActionComplete={() => {
            setActionDrawerOpen(false);
            setSelectedAction(null);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}
