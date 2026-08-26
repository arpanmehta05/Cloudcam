"use client";
import React, { useEffect, useState } from "react";
import { authFetchJson } from "@/lib/auth-fetch";
import { ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck } from "@/icons";

const SUPPORT_EMAIL = "support@cloudcam.fonder.tech";

interface FeatureAccessMeta {
  name: string;
  description: string;
  lockedDescription: string;
  requiredPlanKey: string | null;
}

export interface MyEntitlements {
  tenantId: string;
  planKey: string | null;
  features: Record<string, boolean>;
  featureAccess?: Record<string, FeatureAccessMeta>;
  limits: {
    workspaces?: number | null;
    cloudConnections?: number | null;
    retentionDays?: number | null;
    seats?: number | null;
  };
  source: "subscription" | "default" | "none";
  managed: boolean;
}

const FALLBACK_FEATURE_ACCESS: Record<string, FeatureAccessMeta> = {
  core_monitoring: {
    name: "Core Monitoring",
    description: "Baseline infrastructure health, inventory, and resource visibility.",
    lockedDescription: "Core Monitoring is included with every active Cloudcam plan.",
    requiredPlanKey: "free",
  },
  cost_explorer: {
    name: "Cost Explorer",
    description: "Cloud spend analysis, optimization workflows, and savings context.",
    lockedDescription: "Upgrade to Pro to unlock spend analysis and cost optimization workflows.",
    requiredPlanKey: "pro",
  },
  ai_observability: {
    name: "AI Observability",
    description: "LLM traces, token spend, evals, alerts, and request-level debugging.",
    lockedDescription: "Upgrade to Pro to inspect AI traces, model spend, evals, and quality signals.",
    requiredPlanKey: "pro",
  },
  watchdog: {
    name: "Watchdog",
    description: "Anomaly detection, incident signals, and operational health checks.",
    lockedDescription: "Upgrade to Pro to unlock Watchdog anomaly detection and incident signals.",
    requiredPlanKey: "pro",
  },
  vps_logs: {
    name: "VPS Logs",
    description: "Log forwarding, agent management, alarms, and alert policies for VPS fleets.",
    lockedDescription: "Upgrade to Scale to centralize VPS logs, alarms, and alert policies.",
    requiredPlanKey: "scale",
  },
  simulations: {
    name: "Simulations",
    description: "What-if infrastructure modeling, Terraform preview, and simulated deployments.",
    lockedDescription: "Upgrade to Scale to run infrastructure simulations and deployment previews.",
    requiredPlanKey: "scale",
  },
  dpdp_compliance: {
    name: "DPDP Compliance",
    description: "Data protection compliance tooling, evidence, and governance workflows.",
    lockedDescription: "Upgrade to Scale to unlock DPDP compliance guardrails and reports.",
    requiredPlanKey: "scale",
  },
};

export async function fetchMyEntitlements(): Promise<MyEntitlements> {
  const res = await authFetchJson("/api/entitlements/me");
  return res.entitlements as MyEntitlements;
}

export interface EntitlementsState {
  entitlements: MyEntitlements | null;
  loading: boolean;
  /**
   * Whether the current tenant may use `featureKey`. Unmanaged tenants are
   * enforced from their effective default/free plan.
   */
  hasFeature: (featureKey: string) => boolean;
}

/** Read the current tenant's resolved entitlements for UI gating. */
export function useEntitlements(): EntitlementsState {
  const [entitlements, setEntitlements] = useState<MyEntitlements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchMyEntitlements()
      .then((e) => alive && setEntitlements(e))
      .catch(() => alive && setEntitlements(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const hasFeature = (featureKey: string): boolean => {
    if (!entitlements) return false;
    return entitlements.features[featureKey] === true;
  };

  return { entitlements, loading, hasFeature };
}

/** Render children only when the tenant is entitled to `feature`. */
export function FeatureGate({
  feature,
  children,
  fallback = null,
}: {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasFeature } = useEntitlements();
  return <>{hasFeature(feature) ? children : fallback}</>;
}

function planLabel(planKey?: string | null): string {
  if (!planKey) return "a paid plan";
  return planKey.charAt(0).toUpperCase() + planKey.slice(1);
}

function featureAccessFor(
  feature: string,
  featureLabel: string,
  entitlements: MyEntitlements | null,
): FeatureAccessMeta {
  return (
    entitlements?.featureAccess?.[feature] ||
    FALLBACK_FEATURE_ACCESS[feature] || {
      name: featureLabel,
      description: "This capability is managed by your Cloudcam plan.",
      lockedDescription: "Contact support to enable this capability for your workspace.",
      requiredPlanKey: null,
    }
  );
}

/** Support/purchase dialog opened from the locked feature screen. */
export function FeatureLockModal({
  feature,
  featureLabel,
  entitlements,
  onClose,
}: {
  feature: string;
  featureLabel: string;
  entitlements: MyEntitlements | null;
  onClose: () => void;
}) {
  const meta = featureAccessFor(feature, featureLabel, entitlements);
  const subject = encodeURIComponent(`Unlock ${meta.name}`);
  const body = encodeURIComponent(
    [
      `Hi Cloudcam team,`,
      ``,
      `Please help us unlock ${meta.name}.`,
      `Tenant: ${entitlements?.tenantId || "unknown"}`,
      `Current plan: ${entitlements?.planKey || "none"}`,
      `Required plan: ${meta.requiredPlanKey || "custom"}`,
    ].join("\n"),
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 text-left shadow-2xl">
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Unlock {meta.name}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {meta.lockedDescription} We can help move this tenant to{" "}
          {planLabel(meta.requiredPlanKey)} or apply a tenant-specific override.
        </p>
        <div className="mt-5 rounded-lg border border-border bg-muted/35 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Request context
          </div>
          <div className="mt-3 grid gap-2 text-sm text-foreground sm:grid-cols-2">
            <span>Current plan: {entitlements?.planKey || "none"}</span>
            <span>Required plan: {meta.requiredPlanKey || "custom"}</span>
            <span className="sm:col-span-2">Feature key: {feature}</span>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground transition hover:border-primary"
          >
            Close
          </button>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Mail className="h-4 w-4" />
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

export function LockedFeatureScreen({
  feature,
  featureLabel,
  entitlements,
}: {
  feature: string;
  featureLabel: string;
  entitlements: MyEntitlements | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const meta = featureAccessFor(feature, featureLabel, entitlements);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6 text-foreground lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl items-center">
        <section className="w-full rounded-xl border border-border bg-card p-6 shadow-sm lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/45 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Plan restricted
              </div>
              <h1 className="text-2xl font-semibold tracking-normal text-foreground lg:text-3xl">
                {meta.name} is not included in this tenant&apos;s plan
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                {meta.lockedDescription}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Current plan</div>
                  <div className="mt-1 text-sm font-semibold">{planLabel(entitlements?.planKey || "none")}</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Required plan</div>
                  <div className="mt-1 text-sm font-semibold">{planLabel(meta.requiredPlanKey)}</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Access path</div>
                  <div className="mt-1 text-sm font-semibold">Upgrade or override</div>
                </div>
              </div>
            </div>
            <div className="w-full rounded-lg border border-border bg-muted/30 p-4 lg:max-w-xs">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Why this is locked
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Access is enforced by backend entitlement checks, so browser console changes
                or direct API calls cannot unlock this feature.
              </p>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Request access
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="/plans"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary"
            >
              View billing
            </a>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        </section>
      </div>
      {modalOpen && (
        <FeatureLockModal
          feature={feature}
          featureLabel={featureLabel}
          entitlements={entitlements}
          onClose={() => setModalOpen(false)}
        />
      )}
    </main>
  );
}

/**
 * Wrap a feature's page/UI. Renders a locked access screen when the tenant is
 * not entitled to `feature`. Loading waits for entitlement data; unmanaged
 * tenants are still enforced from the effective default/free plan.
 */
export function FeatureLockedGate({
  feature,
  featureLabel,
  children,
}: {
  feature: string;
  featureLabel: string;
  children: React.ReactNode;
}) {
  const { entitlements, hasFeature, loading } = useEntitlements();
  const blocked = !loading && !hasFeature(feature);
  if (blocked) {
    return (
      <LockedFeatureScreen
        feature={feature}
        featureLabel={featureLabel}
        entitlements={entitlements}
      />
    );
  }

  return <>{children}</>;
}
