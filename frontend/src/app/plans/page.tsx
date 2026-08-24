"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, RefreshCw, Sparkles } from "@/icons";
import { Button } from "@/components/ui/button";
import { authFetchJson, getAuthToken } from "@/lib/auth-fetch";
import { fetchMyEntitlements, type MyEntitlements } from "@/modules/admin/entitlements.client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";

interface FeatureDef {
  key: string;
  name: string;
  description: string;
  group?: string;
}

interface PlanDef {
  key: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingPeriod: string;
  features: Record<string, boolean>;
  limits: {
    workspaces?: number | null;
    cloudConnections?: number | null;
    retentionDays?: number | null;
    seats?: number | null;
  };
}

interface PlansResponse {
  success: boolean;
  plans?: PlanDef[];
  features?: FeatureDef[];
  error?: string;
}

type DisplayPlan = PlanDef & {
  displayName: string;
  eyebrow: string;
  summary: string;
  cta: string;
  highlighted: boolean;
};

const BRAND_NAME = "CloudWatcher";
const BRAND_SUBTITLE = "By Rabbitt Ai";
const SALES_EMAIL = "cloudwatcher@rabbitt.ai";

const navLinks = [
  { label: "Platform", href: "/#platform" },
  { label: "Savings", href: "/#savings" },
  { label: "AI", href: "/#ai" },
  { label: "Agent Watcher", href: "/agent-watcher" },
  { label: "Simulation", href: "/#simulation" },
  { label: "Plans", href: "/plans" },
  { label: "FAQ", href: "/#faq" },
  { label: "Docs", href: "/docs" },
  { label: "Customers", href: "/#customers" },
];

const fallbackPlans: PlanDef[] = [
  {
    key: "free",
    name: "Free",
    description: "Essential cloud cost tracking for small projects.",
    price: 0,
    currency: "USD",
    billingPeriod: "monthly",
    features: { core_monitoring: true, cost_explorer: false, ai_observability: false, watchdog: false },
    limits: { workspaces: 1, cloudConnections: 1, retentionDays: 7, seats: 1 },
  },
  {
    key: "pro",
    name: "Pro",
    description: "Deep cost optimization and AI tracing for teams.",
    price: 49,
    currency: "USD",
    billingPeriod: "monthly",
    features: {
      core_monitoring: true,
      cost_explorer: true,
      ai_observability: true,
      watchdog: true,
      vps_logs: true,
      simulations: true,
    },
    limits: { workspaces: 5, cloudConnections: 10, retentionDays: 90, seats: 5 },
  },
  {
    key: "scale",
    name: "Scale",
    description: "Full regulatory guardrails and enterprise automation.",
    price: 199,
    currency: "USD",
    billingPeriod: "monthly",
    features: {
      core_monitoring: true,
      cost_explorer: true,
      ai_observability: true,
      watchdog: true,
      vps_logs: true,
      simulations: true,
      dpdp_compliance: true,
    },
    limits: { workspaces: null, cloudConnections: null, retentionDays: null, seats: null },
  },
];

const fallbackFeatures: FeatureDef[] = [
  { key: "core_monitoring", name: "Core Monitoring", description: "Baseline infrastructure monitoring." },
  { key: "cost_explorer", name: "Cost Explorer", description: "Cloud cost breakdown and savings." },
  { key: "ai_observability", name: "AI Observability", description: "LLM traces, evals, and budgets." },
  { key: "watchdog", name: "Watchdog", description: "Anomaly and incident detection." },
  { key: "vps_logs", name: "VPS Logs", description: "Log forwarding and alerting for VPS agents." },
  { key: "simulations", name: "Simulations", description: "What-if infrastructure simulations." },
  { key: "dpdp_compliance", name: "DPDP Compliance", description: "Data protection compliance tooling." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

function planTone(plan: PlanDef): Omit<DisplayPlan, keyof PlanDef> {
  if (plan.key === "pro" || plan.key === "team") {
    return {
      displayName: "Team",
      eyebrow: "FOR GROWING TEAMS",
      summary: plan.description || "Shared cost controls, AI traces, simulations, and operational alerting.",
      cta: "Start with Team",
      highlighted: true,
    };
  }

  if (plan.key === "scale" || plan.key === "enterprise") {
    return {
      displayName: "Scale",
      eyebrow: "FOR PLATFORM ORGS",
      summary: plan.description || "Unlimited workspace scale with governance, retention, and automation controls.",
      cta: "Choose Scale",
      highlighted: false,
    };
  }

  return {
    displayName: "Prototype",
    eyebrow: "FOR PROTOTYPES",
    summary: plan.description || "Start with the core monitoring loop for one cloud workspace.",
    cta: "Start free",
    highlighted: false,
  };
}

function formatLimit(value?: number | null, suffix = "") {
  if (value === null || value === undefined) return "Unlimited";
  return `${value}${suffix}`;
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [features, setFeatures] = useState<FeatureDef[]>([]);
  const [entitlements, setEntitlements] = useState<MyEntitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    const tokenPresent = typeof window !== "undefined" && !!getAuthToken();

    Promise.all([
      authFetchJson("/api/plans").catch(() => ({
        success: true,
        plans: fallbackPlans,
        features: fallbackFeatures,
      }) satisfies PlansResponse),
      tokenPresent ? fetchMyEntitlements().catch(() => null) : Promise.resolve(null),
    ])
      .then(([plansData, entitlementsData]) => {
        if (!alive) return;
        setIsLoggedIn(tokenPresent);
        const data = plansData as PlansResponse;
        if (data.success) {
          setPlans(data.plans?.length ? data.plans : fallbackPlans);
          setFeatures(data.features?.length ? data.features : fallbackFeatures);
        } else {
          setError(data.error || "Failed to load plans");
          setPlans(fallbackPlans);
          setFeatures(fallbackFeatures);
        }
        if (entitlementsData) setEntitlements(entitlementsData);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const message = err instanceof Error ? err.message : "Failed to connect to plans server";
        setError(message);
        setPlans(fallbackPlans);
        setFeatures(fallbackFeatures);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const displayPlans = useMemo<DisplayPlan[]>(() => {
    const sorted = [...plans].sort((a, b) => {
      const order = ["free", "prototype", "pro", "team", "scale", "enterprise"];
      const aIndex = order.indexOf(a.key);
      const bIndex = order.indexOf(b.key);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });

    return sorted.slice(0, 3).map((plan) => ({ ...plan, ...planTone(plan) }));
  }, [plans]);

  const handleSubscribe = async (planKey: string) => {
    if (!isLoggedIn) {
      router.push(`/signup?plan=${planKey}`);
      return;
    }

    setSubmittingKey(planKey);
    setError(null);

    try {
      const res = await authFetchJson("/api/plans/subscribe", undefined, {
        method: "POST",
        body: JSON.stringify({ planKey }),
      });

      if (res.success) {
        const e = await fetchMyEntitlements().catch(() => null);
        if (e) setEntitlements(e);
      } else {
        setError(res.error || "Subscription upgrade failed");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred during upgrade";
      setError(message);
    } finally {
      setSubmittingKey(null);
    }
  };

  const formatPrice = (price: number, currency = "USD") => {
    const adjusted = isYearly ? price * 0.8 : price;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(adjusted);
  };

  const navSecondaryLink = isLoggedIn
    ? { label: "Go to Dashboard", href: "/dashboard" }
    : { label: "Sign in", href: "/login" };

  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      <Navbar
        brand={{ label: BRAND_NAME, ariaLabel: `${BRAND_NAME} home`, subtitle: BRAND_SUBTITLE }}
        links={navLinks}
        secondaryLink={navSecondaryLink}
        cta={isLoggedIn ? undefined : { label: "Start free", href: "/signup" }}
      />

      <main>
        <section
          className="relative overflow-hidden border-b border-[#E2E8F0]"
          style={{
            background:
              "radial-gradient(circle at 12% 12%, rgba(26,86,219,0.14), transparent 34%), radial-gradient(circle at 88% 8%, rgba(249,115,22,0.14), transparent 28%), linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 76%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="relative mx-auto max-w-7xl px-5 pb-14 pt-16 sm:pt-20 lg:px-8 lg:pb-20 lg:pt-24"
          >
            <div className="max-w-4xl">
              <motion.p
                variants={fadeUp}
                className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]"
              >
                . Pricing
              </motion.p>
              <motion.h1
                variants={fadeUp}
                className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-[#020617] sm:text-6xl"
              >
                Pick the operating model for your cloud and AI spend.
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-5 max-w-2xl text-base leading-7 text-[#475569] sm:text-lg">
                Start with one workspace, then scale into shared FinOps reviews, LLM cost tracing, simulations,
                and governance without changing tools.
              </motion.p>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-9 w-9 animate-spin text-[#1A56DB]" />
                <span className="text-sm font-extrabold text-[#64748B]">Loading plans...</span>
              </div>
            </div>
          ) : (
            <>
              {error ? (
                <div className="mb-6 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-4 text-sm font-bold text-[#7C2D12]">
                  {error}
                </div>
              ) : null}

              <div className="mb-10 flex justify-center">
                <div className="inline-flex rounded-xl border border-[#CBD5E1] bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsYearly(false)}
                    className={`h-11 rounded-lg px-8 text-sm font-extrabold transition-colors ${
                      !isYearly
                        ? "bg-[#1A56DB] text-white shadow-sm"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                    aria-pressed={!isYearly}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsYearly(true)}
                    className={`h-11 rounded-lg px-8 text-sm font-extrabold transition-colors ${
                      isYearly
                        ? "bg-[#1A56DB] text-white shadow-sm"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                    aria-pressed={isYearly}
                  >
                    Annual
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${isYearly ? "bg-white/15 text-white" : "bg-[#DCFCE7] text-[#14532D]"}`}>
                      Save 20%
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid items-stretch gap-6 lg:grid-cols-3">
                {displayPlans.map((plan) => {
                  const isCurrent = entitlements?.planKey === plan.key;
                  const isFreePlan = plan.price === 0 || plan.key === "free" || plan.key === "prototype";
                  const featureCount = Object.values(plan.features).filter(Boolean).length;
                  const cardClass = plan.highlighted
                    ? "relative z-10 flex h-full flex-col overflow-hidden rounded-2xl border border-[#102A43] bg-[linear-gradient(120deg,#06111F_0%,#0B1B33_48%,#102A43_100%)] p-6 text-white shadow-[0_28px_80px_rgba(2,6,23,0.24)]"
                    : "flex h-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 text-[#0F172A] shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-[#BFDBFE] hover:shadow-md";
                  const muted = plan.highlighted ? "text-[#CBD5E1]" : "text-[#64748B]";
                  const divider = plan.highlighted ? "border-white/10" : "border-[#E2E8F0]";

                  return (
                    <motion.article
                      key={plan.key}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className={cardClass}
                    >
                      {plan.highlighted ? (
                        <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                          <Sparkles className="h-3.5 w-3.5" />
                          Most popular
                        </span>
                      ) : null}

                      <p className={`text-xs font-extrabold uppercase tracking-[0.14em] ${plan.highlighted ? "text-[#93C5FD]" : "text-[#1A56DB]"}`}>
                        . {plan.eyebrow}
                      </p>
                      <h2 className={`mt-5 text-2xl font-extrabold tracking-tight ${plan.highlighted ? "text-white" : "text-[#020617]"}`}>
                        {plan.displayName}
                      </h2>
                      <p className={`mt-3 min-h-16 text-sm leading-6 ${muted}`}>
                        {plan.summary}
                      </p>

                      <div className={`mt-6 border-t ${divider} pt-6`}>
                        <div className="flex items-end gap-2">
                          <span className={`text-5xl font-extrabold tracking-tight ${plan.highlighted ? "text-white" : "text-[#020617]"}`}>
                            {formatPrice(plan.price, plan.currency)}
                          </span>
                          <span className={`pb-2 text-sm font-bold ${muted}`}>/mo</span>
                        </div>
                        <p className={`mt-2 text-xs font-semibold ${muted}`}>
                          {isYearly ? "Billed annually after discount" : "Billed monthly"}
                        </p>
                      </div>

                      <div className={`mt-6 border-t ${divider} pt-6 text-sm`}>
                        <p className={`mb-1 text-xs font-extrabold uppercase tracking-[0.14em] ${muted}`}>
                          Included limits
                        </p>
                        {[
                          ["Workspaces", formatLimit(plan.limits.workspaces)],
                          ["Connections", formatLimit(plan.limits.cloudConnections)],
                          ["Retention", formatLimit(plan.limits.retentionDays, "d")],
                          ["Seats", formatLimit(plan.limits.seats)],
                        ].map(([label, value]) => (
                          <div key={label} className={`flex items-center justify-between border-b ${divider} py-3 last:border-b-0`}>
                            <p className={`font-semibold ${muted}`}>{label}</p>
                            <p className={`font-extrabold ${plan.highlighted ? "text-white" : "text-[#0F172A]"}`}>{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6">
                        {isCurrent && isFreePlan ? (
                          <div className="flex h-12 w-full items-center justify-center rounded-md border border-[#DBEAFE] bg-[#EFF6FF] text-sm font-extrabold text-[#1A56DB]">
                            Current free plan
                          </div>
                        ) : isCurrent ? (
                          <Button
                            asChild
                            variant={plan.highlighted ? "secondary" : "outline"}
                            className="h-12 w-full rounded-md font-bold"
                          >
                            <Link href="/profile?tab=account">Manage billing</Link>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSubscribe(plan.key)}
                            disabled={submittingKey === plan.key}
                            variant={plan.highlighted ? "secondary" : "outline"}
                            className={`h-12 w-full rounded-md font-bold ${
                              plan.highlighted
                                ? "bg-white text-[#0F172A] hover:bg-[#EFF6FF] hover:text-[#1A56DB]"
                                : "border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] hover:text-[#1A56DB]"
                            }`}
                          >
                            {submittingKey === plan.key ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                {plan.cta}
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      <div className={`mt-7 flex-1 border-t ${divider} pt-6`}>
                        <p className={`mb-4 text-xs font-extrabold uppercase tracking-[0.14em] ${muted}`}>
                          {featureCount} controls included
                        </p>
                        <ul className="space-y-3">
                          {features
                            .filter((feature) => plan.features[feature.key])
                            .slice(0, 6)
                            .map((feature) => (
                              <li key={feature.key} className="flex gap-3 text-sm">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" />
                                <span className={plan.highlighted ? "text-[#E2E8F0]" : "text-[#334155]"}>{feature.name}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {!loading ? (
          <section className="border-y border-[#E2E8F0] bg-[#F8FAFC] px-5 py-16 lg:px-8 lg:py-24">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr]">
              <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]">
                  . Plan detail
                </p>
                <h2 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-5xl">
                  Compare the limits before your team commits.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-[#475569]">
                  The card view keeps the choice simple. This table gives operators the numbers they need for
                  workspace rollout, retention, and ownership planning.
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                <div className="min-w-[680px]">
                  <div className="grid grid-cols-[1.25fr_repeat(3,0.85fr)] border-b border-[#E2E8F0] bg-white text-xs font-extrabold uppercase tracking-[0.14em] text-[#64748B]">
                    <div className="p-4">Capability</div>
                    {displayPlans.map((plan) => (
                      <div key={plan.key} className="border-l border-[#E2E8F0] p-4 text-[#0F172A]">
                        {plan.displayName}
                      </div>
                    ))}
                  </div>
                  {[
                    ["Workspaces", (plan: DisplayPlan) => formatLimit(plan.limits.workspaces)],
                    ["Cloud connections", (plan: DisplayPlan) => formatLimit(plan.limits.cloudConnections)],
                    ["Data retention", (plan: DisplayPlan) => formatLimit(plan.limits.retentionDays, " days")],
                    ["Seats", (plan: DisplayPlan) => formatLimit(plan.limits.seats)],
                    ["Enabled controls", (plan: DisplayPlan) => String(Object.values(plan.features).filter(Boolean).length)],
                  ].map(([label, resolver]) => (
                    <div
                      key={label as string}
                      className="grid grid-cols-[1.25fr_repeat(3,0.85fr)] border-b border-[#E2E8F0] text-sm last:border-b-0"
                    >
                      <div className="p-4 font-bold text-[#0F172A]">{label as string}</div>
                      {displayPlans.map((plan) => (
                        <div key={`${plan.key}-${label}`} className="border-l border-[#E2E8F0] p-4 font-semibold text-[#475569]">
                          {(resolver as (plan: DisplayPlan) => string)(plan)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="px-5 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-3xl border border-[#CBD5E1] bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_48%,#FFF7ED_100%)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
            <div>
              <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]">
                . Still deciding?
              </p>
              <h2 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-5xl">
                Bring your cloud bill, AI provider mix, and rollout plan.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#475569]">
                We will map the right tier to your current operating model and the next quarter of usage growth.
              </p>
            </div>
            <Link
              href={`mailto:${SALES_EMAIL}?subject=CloudWatcher pricing consultation`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#1A56DB] px-6 text-sm font-bold text-white shadow-[0_14px_34px_rgba(26,86,219,0.22)] transition-colors hover:bg-[#1040A0]"
            >
              Talk to sales
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
