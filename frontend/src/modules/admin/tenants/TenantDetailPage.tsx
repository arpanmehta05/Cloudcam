"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiClientError } from "@/lib/auth-fetch";
import { ArrowLeft, Lock, ShieldCheck, Wallet } from "@/icons";
import {
  fetchTenant,
  fetchPlans,
  fetchFeatures,
  assignTenantPlan,
  setTenantOverrides,
} from "../api";
import type { Feature, Plan, TenantDetail } from "../types";
import {
  Card,
  PageHeader,
  Btn,
  Toggle,
  Pill,
  Spinner,
  ErrorState,
  SectionHeader,
} from "../components/ui";
import { limitLabel } from "../format";

const FEATURE_GROUPS: Record<string, string> = {
  core_monitoring: "Monitoring",
  watchdog: "Monitoring",
  vps_logs: "Monitoring",
  cost_explorer: "Cost control",
  simulations: "Automation",
  ai_observability: "AI operations",
  dpdp_compliance: "Governance",
};

const REQUIRED_PLAN: Record<string, string> = {
  core_monitoring: "free",
  cost_explorer: "pro",
  ai_observability: "pro",
  watchdog: "pro",
  vps_logs: "scale",
  simulations: "scale",
  dpdp_compliance: "scale",
};

function planName(key?: string | null): string {
  if (!key) return "No plan";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function featureGroup(key: string): string {
  return FEATURE_GROUPS[key] || "Platform";
}

export function TenantDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [d, p, f] = await Promise.all([fetchTenant(id), fetchPlans(), fetchFeatures()]);
      setDetail(d);
      setPlans(p);
      setFeatures(f.filter((x) => x.isActive));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (error || !detail)
    return <ErrorState message={error || "Failed to load"} onRetry={load} />;

  const { tenant, subscription, entitlements } = detail;
  const overrides = subscription?.overrides?.features || {};
  const enabledCount = features.filter((f) => entitlements.features[f.key]).length;
  const blockedCount = features.filter(
    (f) => Object.prototype.hasOwnProperty.call(overrides, f.key) && overrides[f.key] === false,
  ).length;

  return (
    <div>
      <PageHeader
        title={tenant.name}
        route="/admin/tenants/[id]"
        description="Manage plan assignment, tenant limits, and feature-level access enforcement."
        actions={
          <Btn variant="ghost" onClick={() => router.push("/admin/tenants")}>
            <ArrowLeft className="h-4 w-4" /> Tenants
          </Btn>
        }
      />

      {error && (
        <div className="mb-4 rounded-[9px] border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <Card className="mb-3.5 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border/60 px-4 py-4 lg:flex-row lg:items-start">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-lg bg-primary text-[17px] font-bold text-primary-foreground">
            {(tenant.name || "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[16px]">{tenant.name}</b>
              <Pill tone={subscription ? "good" : "off"}>
                {subscription ? subscription.status : "unmanaged"}
              </Pill>
            </div>
            {tenant.email && (
              <div className="text-[12.5px] text-muted-foreground">{tenant.email}</div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
              <span className="font-mono">{tenant.id}</span>
              <span>Created {new Date(tenant.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 lg:ml-auto lg:w-[360px]">
            <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Assigned plan
                </div>
                <div className="mt-0.5 text-[13px] font-semibold">{planName(subscription?.planKey)}</div>
              </div>
              <select
                value={subscription?.planKey || ""}
                disabled={busy}
                onChange={(e) => withBusy(() => assignTenantPlan(id, e.target.value))}
                className="max-w-[168px] rounded-lg border border-input bg-card px-3 py-2 text-[12.5px] font-medium"
              >
                <option value="" disabled>
                  Select plan
                </option>
                {plans.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                    {!p.isPublic ? " (hidden)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg border border-border bg-muted/35 px-3 py-2">
                <div className="text-muted-foreground">Enabled</div>
                <div className="font-semibold">{enabledCount} features</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/35 px-3 py-2">
                <div className="text-muted-foreground">Blocked overrides</div>
                <div className="font-semibold">{blockedCount}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-px bg-border/60 sm:grid-cols-3">
          {(
            [
              ["Workspaces", entitlements.limits.workspaces],
              ["Cloud connections", entitlements.limits.cloudConnections],
              ["Retention (days)", entitlements.limits.retentionDays],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="bg-card px-4 py-3">
              <div className="text-[11.5px] text-muted-foreground">{label}</div>
              <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">
                {limitLabel(v)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Feature entitlements"
          meta="backend-enforced plan defaults and tenant overrides"
          action={
            <span className="hidden items-center gap-1.5 text-[11.5px] text-muted-foreground sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--good,#16a34a)]" />
              API locked
            </span>
          }
        />
        {features.map((f) => {
          const on = !!entitlements.features[f.key];
          const isOverride = Object.prototype.hasOwnProperty.call(overrides, f.key);
          const blocked = isOverride && overrides[f.key] === false;
          const access = entitlements.featureAccess?.[f.key];
          const requiredPlan = access?.requiredPlanKey || REQUIRED_PLAN[f.key] || "custom";
          const description = access?.description || f.description || "Managed by plan and tenant override.";
          return (
            <div
              key={f.key}
              className="grid gap-3 border-t border-border/60 px-4 py-3 first:border-t-0 lg:grid-cols-[minmax(220px,1.1fr)_minmax(260px,1.5fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                  {f.name}
                  <span className="rounded-md border border-border bg-muted/55 px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">
                    {featureGroup(f.key)}
                  </span>
                  {isOverride && (
                    <span
                      className={
                        "rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide " +
                        (blocked
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-accent-foreground")
                      }
                    >
                      {blocked ? "blocked" : "+ override"}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {f.key}
                </div>
              </div>
              <div className="text-[12.5px] leading-5 text-muted-foreground">
                {description}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" />
                    Requires {planName(requiredPlan)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    {isOverride ? "Tenant override" : "Plan default"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-start gap-3 lg:justify-end">
                {isOverride && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => withBusy(() => setTenantOverrides(id, { features: { [f.key]: null } }))}
                    className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    revert
                  </button>
                )}
                <Pill tone={blocked ? "blocked" : on ? "good" : "off"}>
                  {blocked ? "Blocked" : on ? "On" : "Off"}
                </Pill>
                <Toggle
                  checked={on}
                  blocked={blocked}
                  disabled={busy}
                  ariaLabel={`Toggle ${f.name}`}
                  onClick={() => withBusy(() => setTenantOverrides(id, { features: { [f.key]: !on } }))}
                />
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
