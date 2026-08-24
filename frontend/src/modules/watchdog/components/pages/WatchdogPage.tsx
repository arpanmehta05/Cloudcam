"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Shield,
  Zap,
  Database,
  Server,
  HardDrive,
  Network,
  Globe,
  CheckCircle2,
  ArrowUpRight,
  Container,
  Scaling,
  Route,
  Workflow,
  TableProperties,
  Flame,
  BarChart3,
  FolderOpen,
  FileVolume,
  Wifi,
  Inbox,
  Bell,
  Plug,
  DollarSign,
  RefreshCw,
  Radar,
  Sparkles,
  AlertTriangle,
} from "@/icons";
import Link from "next/link";
import { LivePulse } from "@/components/LivePulse";
import { SERVICE_REGISTRY } from "@/lib/services/registry";
import { authFetch } from "@/lib/auth-fetch";
import { useRegion } from "@/context/RegionContext";
import { cn } from "@/lib/utils";

const iconMap: Record<string, any> = {
  Activity,
  Shield,
  Zap,
  Database,
  Server,
  HardDrive,
  Network,
  Globe,
  Container,
  Scaling,
  Route,
  Workflow,
  TableProperties,
  Flame,
  BarChart3,
  FolderOpen,
  FileVolume,
  Wifi,
  Inbox,
  Bell,
  Plug,
  DollarSign,
};

export default function WatchdogPage() {
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<any>({});
  const [lastUpdated, setLastUpdated] = useState("");
  const { selectedProvider, selectedRegion } = useRegion();

  const fetchGlobalHealth = useCallback(async () => {
    setLoading(true);
    try {
      const extraRequests =
        selectedProvider === "gcp"
          ? [
              authFetch(`/api/gcp/billing?range=24h`),
              authFetch(
                `/api/gcp/metrics?service=apigateway&range=1h&region=${selectedRegion}`,
              ),
            ]
          : [];
      const [invRes, secRes, billingRes, apiMetricsRes] = await Promise.all([
        authFetch(
          `/api/${selectedProvider}/resources?region=${selectedRegion}`,
        ),
        authFetch(`/api/${selectedProvider}/security?region=${selectedRegion}`),
        ...extraRequests,
      ]);
      const [invData, secData, billingData, apiMetricsData] = await Promise.all(
        [
          invRes.json(),
          secRes.json(),
          billingRes ? billingRes.json() : Promise.resolve(null),
          apiMetricsRes ? apiMetricsRes.json() : Promise.resolve(null),
        ],
      );

      const inventory = invData.inventory || {};
      const serviceHealth: any = {};

      Object.keys(SERVICE_REGISTRY).forEach((key) => {
        const service = SERVICE_REGISTRY[key];
        const count = inventory.counts?.[key] || 0;

        serviceHealth[key] = {
          ...service,
          activeCount: count,
          status: count > 0 ? "healthy" : "inactive",
          alertCount: 0,
        };
      });

      if (selectedProvider === "gcp") {
        const requestPoints = apiMetricsData?.metrics?.requests?.data || [];
        const hasApiTraffic = requestPoints.some(
          (point: any) => Number(point.value || 0) > 0,
        );
        if (serviceHealth.apigateway && hasApiTraffic) {
          serviceHealth.apigateway.activeCount = 1;
          serviceHealth.apigateway.status = "healthy";
          serviceHealth.apigateway.signalLabel = "API traffic";
        }

        if (
          serviceHealth.billing &&
          billingData?.success &&
          !billingData?.setupRequired
        ) {
          serviceHealth.billing.activeCount = 1;
          serviceHealth.billing.status = "healthy";
          serviceHealth.billing.signalLabel = billingData?.isSimulated
            ? "Billing configured"
            : "Billing export";
        }
        if (
          serviceHealth.cost &&
          billingData?.success &&
          !billingData?.setupRequired
        ) {
          serviceHealth.cost.activeCount = 1;
          serviceHealth.cost.status = "healthy";
          serviceHealth.cost.signalLabel = billingData?.isSimulated
            ? "Billing configured"
            : "Billing export";
        }

        if (serviceHealth.security && secData?.success) {
          serviceHealth.security.activeCount = 1;
          serviceHealth.security.status =
            secData.security?.threats?.count > 0 ? "warning" : "healthy";
          serviceHealth.security.alertCount =
            secData.security?.threats?.count || 0;
          serviceHealth.security.signalLabel =
            secData.security?.threats?.status === "active_iam_fallback"
              ? "IAM audit"
              : "Security signal";
        }
      }

      if (secData.security?.threats?.count > 0) {
        serviceHealth.security.status = "warning";
        serviceHealth.security.alertCount = secData.security.threats.count;
      }

      setHealthStatus(serviceHealth);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Global health fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedProvider, selectedRegion]);

  useEffect(() => {
    fetchGlobalHealth();
    const interval = setInterval(fetchGlobalHealth, 300000);
    return () => clearInterval(interval);
  }, [fetchGlobalHealth]);

  const activeServices = Object.values(healthStatus).filter(
    (s: any) => s.activeCount > 0,
  );
  const totalIssues = Object.values(healthStatus).reduce(
    (acc: number, s: any) => acc + (s.alertCount || 0),
    0,
  );
  const totalServices = Object.keys(SERVICE_REGISTRY).length;

  const summaryCards = [
    {
      label: "Fleet status",
      value: loading ? "-" : `${activeServices.length}/${totalServices}`,
      sub: "active services",
      icon: Radar,
      accent: "#1A56DB",
    },
    {
      label: "Attention required",
      value: loading ? "-" : String(totalIssues),
      sub: "security findings",
      icon: totalIssues > 0 ? AlertTriangle : Shield,
      accent: totalIssues > 0 ? "#EF4444" : "#22C55E",
      href: "/dashboards/security",
    },
    {
      label: "Optimization",
      value: (() => {
        try {
          const cached =
            typeof window !== "undefined"
              ? sessionStorage.getItem("rabbittize_insights")
              : null;
          if (cached) {
            const data = JSON.parse(cached);
            return String(
              (data.insights?.recommendations?.length || 0) +
                (data.insights?.optimizations?.length || 0),
            );
          }
        } catch {}
        return "-";
      })(),
      sub: "saving opportunities",
      icon: Sparkles,
      accent: "#F97316",
      href: "/recommendations",
    },
  ];

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-[#E2E8F0] bg-white/88 p-5 shadow-sm backdrop-blur-xl dark:border-[#1E293B] dark:bg-[#07111F]/88">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-transparent px-3 py-1 text-xs font-extrabold text-[#1A56DB] shadow-sm dark:border-[#1D4ED8]/50 dark:text-[#6BA3F8]">
              <Radar className="h-3.5 w-3.5" />
              <LivePulse className="h-2.5 w-2.5" />
              Watchdog
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#020617] dark:text-white">
              Fleet Watchdog
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
              Real-time health signals across discovered cloud services,
              security posture, and optimization surfaces.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated ? (
              <span className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#64748B] dark:border-[#334155] dark:bg-[#0B1728] dark:text-[#94A3B8]">
                Updated {lastUpdated}
              </span>
            ) : null}
            <Button
              onClick={fetchGlobalHealth}
              disabled={loading}
              variant="outline"
              className="h-10"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const content = (
            <Card className="min-h-[156px] gap-0 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">
                    {card.label}
                  </p>
                  <p className="mt-4 text-4xl font-extrabold tracking-tight text-[#020617] dark:text-white">
                    {card.value}
                  </p>
                </div>
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center"
                  style={{ color: card.accent }}
                >
                  <Icon className="h-8 w-8 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-[#E2E8F0] pt-4 dark:border-[#1E293B]">
                <span className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                  {card.sub}
                </span>
                {card.href ? (
                  <ArrowUpRight className="h-4 w-4 text-[#94A3B8]" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                )}
              </div>
            </Card>
          );
          return card.href ? (
            <Link key={card.label} href={card.href}>
              {content}
            </Link>
          ) : (
            <div key={card.label}>{content}</div>
          );
        })}
      </div>

      <section className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-[#1E293B] dark:bg-[#0B1728]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#020617] dark:text-white">
              Health grid
            </h2>
            <p className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
              Service status, active resources, and alerts.
            </p>
          </div>
          <Badge variant="secondary">{selectedRegion}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.keys(SERVICE_REGISTRY).map((key) => {
            const service = healthStatus[key] || {
              ...SERVICE_REGISTRY[key],
              status: "loading",
              activeCount: 0,
            };
            const isActive = service.activeCount > 0;
            const isWarning = service.status === "warning";
            const Icon = iconMap[service.icon] || Activity;

            return (
              <Link key={key} href={`/dashboards/${key}`} className="group">
                <Card
                  className={cn("h-32 gap-0 p-4", !isActive && "opacity-60")}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center",
                        isWarning
                          ? "text-[#EF4444]"
                          : isActive
                            ? "text-[#1A56DB]"
                            : "text-[#64748B]",
                        "dark:text-[#6BA3F8]",
                      )}
                    >
                      <Icon className="h-7 w-7 drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
                    </span>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        isWarning
                          ? "bg-[#EF4444]"
                          : isActive
                            ? "bg-[#22C55E]"
                            : "bg-[#CBD5E1]",
                      )}
                    />
                  </div>
                  <div className="mt-auto">
                    <h4 className="truncate text-sm font-extrabold text-[#0F172A] dark:text-white">
                      {selectedProvider === "azure" && service.azureDisplayName
                        ? service.azureDisplayName
                        : selectedProvider === "gcp" && service.gcpDisplayName
                          ? service.gcpDisplayName
                          : service.displayName}
                    </h4>
                    <p className="mt-1 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      {isActive
                        ? service.signalLabel ||
                          `${service.activeCount} resources`
                        : "Not discovered"}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
