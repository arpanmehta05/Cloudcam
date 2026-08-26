"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  Gauge,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from "@/icons";
import { Button } from "@/components/ui/button";

const BRAND_NAME = "Cloudcam";
const BRAND_LOGO_SRC = "/Logo.svg";

/* ── animation variants ─────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.2, 0, 0.2, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

/* ── dashboard mockup (product visual) ──────────────────────── */
function DashboardMockup() {
  const shouldReduceMotion = useReducedMotion();
  const featurePages = [
    {
      id: "overview",
      label: "Overview",
      href: "/dashboard",
      icon: Gauge,
      kicker: "Command center",
      title: "Cloudcam Overview",
      description: "A live-style workspace for owned cloud, AI, cost, and security workflows.",
      stats: [
        ["Monthly spend", "$1.23M", "+3.5%"],
        ["Waste found", "$90.5K", "-18.4%"],
        ["AI tokens", "2.3M", "+12.1%"],
        ["Open alerts", "7", "Live"],
      ],
      rows: ["EC2 fleet stable across us-east-1", "AI Gateway spend up 12.1%", "Security checks healthy"],
      bars: [58, 72, 44, 84, 62, 76, 55, 91, 68, 49, 73, 60],
      accent: "#1A56DB",
    },
    {
      id: "cost",
      label: "Cost Reports",
      href: "/cost-savings",
      icon: TrendingDown,
      kicker: "FinOps",
      title: "Cost Optimization",
      description: "Dummy savings opportunities, pricing mix, and realized impact just like the inner cost page.",
      stats: [
        ["Potential savings", "$42.8K", "per month"],
        ["Ready actions", "18", "validated"],
        ["Realized", "$16.4K", "+22%"],
        ["Confidence", "91%", "High"],
      ],
      rows: ["Right-size 12 compute workloads", "Move 4 steady workloads to savings plans", "Delete 9 unattached storage volumes"],
      bars: [64, 48, 72, 38, 58, 81, 53, 45, 69, 77, 41, 59],
      accent: "#F97316",
    },
    {
      id: "ai",
      label: "AI Observability",
      href: "/ai-observability",
      icon: Bot,
      kicker: "AI control center",
      title: "AI Observability",
      description: "Provider spend, traces, model routing, prompt insights, and reliability alerts.",
      stats: [
        ["Requests", "148K", "7d"],
        ["Tokens", "12.4M", "+8.2%"],
        ["Spend", "$8.9K", "projected"],
        ["Errors", "0.8%", "low"],
      ],
      rows: ["Trace Explorer linked to billing", "Prompt compression can save $1.8K/mo", "Claude route recommended for support summaries"],
      bars: [42, 66, 71, 50, 83, 61, 76, 58, 89, 69, 47, 78],
      accent: "#06B6D4",
    },
    {
      id: "watchdog",
      label: "Watchdog",
      href: "/watchdog",
      icon: Radar,
      kicker: "Operations",
      title: "Fleet Watchdog",
      description: "Service health, security posture, and active fleet signals across owned operations.",
      stats: [
        ["Fleet status", "14/18", "active"],
        ["Issues", "3", "review"],
        ["SLO", "99.95%", "healthy"],
        ["Refresh", "Live", "pulse"],
      ],
      rows: ["Security Hub warning detected", "RDS backup age needs review", "Lambda error budget remains green"],
      bars: [76, 82, 68, 88, 73, 79, 84, 69, 91, 86, 80, 77],
      accent: "#22C55E",
    },
    {
      id: "insights",
      label: "Insights",
      href: "/recommendations",
      icon: Sparkles,
      kicker: "Recommendations",
      title: "AI Insights",
      description: "Optimization recommendations grouped with owner, evidence, risk, and next action.",
      stats: [
        ["Ideas", "24", "ranked"],
        ["High impact", "8", "ready"],
        ["Risk", "Low", "guarded"],
        ["Owners", "6", "teams"],
      ],
      rows: ["Tag coverage drift in platform account", "Idle NAT gateway detected", "Model routing can reduce nightly batch spend"],
      bars: [51, 69, 57, 74, 88, 63, 49, 79, 86, 61, 72, 66],
      accent: "#8B5CF6",
    },
    {
      id: "simulation",
      label: "Simulation",
      href: "/simulations/live-canvas",
      icon: Rocket,
      kicker: "Infrastructure lab",
      title: "Live Simulation",
      description: "Dummy deployment canvas with generated topology, cost impact, and execution status.",
      stats: [
        ["Nodes", "11", "planned"],
        ["Monthly cost", "$684", "estimate"],
        ["Drift checks", "5", "passed"],
        ["Deploy", "Ready", "review"],
      ],
      rows: ["VPC, EKS, and RDS preview generated", "Cost delta within monthly budget", "Rollback plan attached"],
      bars: [39, 52, 67, 76, 61, 87, 73, 57, 82, 70, 45, 64],
      accent: "#0EA5E9",
    },
    {
      id: "logs",
      label: "VPS Logs",
      href: "/vps-logs",
      icon: FileText,
      kicker: "Runtime logs",
      title: "VPS Log Review",
      description: "Recent server log streams, search results, and anomaly hints in one operational view.",
      stats: [
        ["Events", "38K", "24h"],
        ["Warnings", "12", "triaged"],
        ["Errors", "2", "open"],
        ["Sources", "5", "online"],
      ],
      rows: ["api-02 latency spike recovered", "worker queue drained after retry", "ssh audit clean for last 24h"],
      bars: [44, 48, 52, 64, 58, 71, 66, 69, 73, 62, 55, 49],
      accent: "#334155",
    },
    {
      id: "dpdp",
      label: "DPDP Tools",
      href: "/dpdp-compliance",
      icon: ShieldCheck,
      kicker: "Compliance",
      title: "DPDP Tools",
      description: "Privacy workflow coverage with requests, evidence, retention checks, and controls.",
      stats: [
        ["Requests", "19", "open"],
        ["Evidence", "96%", "covered"],
        ["Retention", "4", "checks"],
        ["Risk", "Low", "green"],
      ],
      rows: ["Consent export ready for review", "Retention policy mapped to 4 systems", "Data principal request SLA on track"],
      bars: [70, 75, 73, 80, 77, 83, 79, 85, 88, 82, 78, 84],
      accent: "#14B8A6",
    },
  ] as const;

  const [activeId, setActiveId] = useState<(typeof featurePages)[number]["id"]>("overview");
  const activePage = featurePages.find((page) => page.id === activeId) || featurePages[0];
  const ActiveIcon = activePage.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        opacity: { duration: 0.7, ease: [0.2, 0, 0.2, 1] },
        scale: { duration: 0.7, ease: [0.2, 0, 0.2, 1] },
        y: { duration: shouldReduceMotion ? 0 : 0.7, ease: [0.2, 0, 0.2, 1] },
      }}
      className="relative mx-auto mt-12 w-full max-w-5xl transform-gpu text-left will-change-transform"
    >
      <div className="absolute inset-x-10 -top-3 h-3 rounded-t-lg bg-[#1A56DB]" />
      <div className="overflow-hidden rounded-xl border border-[#DBEAFE] bg-white shadow-[0_24px_80px_rgba(26,86,219,0.18)]">
        {/* title bar */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-md">
              <Image
                src={BRAND_LOGO_SRC}
                alt="Cloudcam Logo"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
                priority
              />
            </div>
            <span className="text-sm font-semibold text-[#0F172A]">
              {BRAND_NAME}
            </span>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-semibold text-[#14532D]">
              All systems operational
            </span>
            <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-semibold text-[#1040A0]">
              us-east-1
            </span>
          </div>
        </div>

        {/* body */}
        <div className="grid min-h-[430px] grid-cols-1 md:grid-cols-[210px_1fr]">
          <aside className="border-b border-[#E2E8F0] bg-[#F8FAFC] p-3 md:border-b-0 md:border-r md:p-4">
            <div className="flex gap-2 overflow-x-auto md:block md:overflow-visible">
              {featurePages.map((item) => {
                const Icon = item.icon;
                const active = item.id === activePage.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={`mb-0 flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition md:mb-2 md:w-full md:min-w-0 ${
                      active
                        ? "bg-[#DBEAFE] text-[#1A56DB] shadow-sm"
                        : "text-[#64748B] hover:bg-white hover:text-[#0F172A]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-[#E2E8F0]"
                  style={{ color: activePage.accent }}
                >
                  <ActiveIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]">
                    {activePage.kicker}
                  </p>
                  <h3 className="mt-1 truncate text-lg font-extrabold text-[#020617]">
                    {activePage.title}
                  </h3>
                  <p className="mt-1 max-w-xl text-xs font-medium leading-5 text-[#64748B]">
                    {activePage.description}
                  </p>
                </div>
              </div>
              <Link
                href={activePage.href}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-extrabold text-[#0F172A] shadow-sm transition hover:border-[#1A56DB] hover:text-[#1A56DB]"
              >
                Open page <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* stat cards */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {activePage.stats.map(([label, value, delta]) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#E2E8F0] bg-white p-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
                    {label}
                  </p>
                  <div className="mt-2 flex items-end justify-between">
                    <span className="text-lg font-bold text-[#0F172A]">
                      {value}
                    </span>
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: activePage.accent }}
                    >
                      {delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* chart */}
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {activePage.label} snapshot
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Dummy data preview for the real inner page
                  </p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-[#1A56DB] shadow-sm">
                  30d
                </span>
              </div>
              <div className="flex h-40 items-end gap-2">
                {activePage.bars.map((height, index) => (
                  <div
                    key={index}
                    className="flex flex-1 flex-col justify-end gap-1"
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{
                        duration: 0.65,
                        delay: 0.2 + index * 0.04,
                        ease: [0.2, 0, 0.2, 1],
                      }}
                      className="rounded-t-sm"
                      style={{ backgroundColor: activePage.accent }}
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(18, 100 - height)}%` }}
                      transition={{
                        duration: 0.65,
                        delay: 0.28 + index * 0.04,
                        ease: [0.2, 0, 0.2, 1],
                      }}
                      className="rounded-b-sm bg-[#FED7AA]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {activePage.rows.map((row, index) => (
                <div
                  key={row}
                  className="flex min-h-14 items-start gap-2 rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-sm"
                >
                  {index === 0 ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" />
                  ) : index === 1 ? (
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[#1A56DB]" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F97316]" />
                  )}
                  <span className="text-xs font-semibold leading-5 text-[#334155]">
                    {row}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── side marker lines (decorative) ─────────────────────────── */
function SideMarkers() {
  const ticks = [80, 160, 240, 320, 400, 480];
  return (
    <>
      {/* left */}
      <svg
        className="pointer-events-none absolute left-4 top-0 hidden h-full w-4 lg:block"
        aria-hidden="true"
      >
        <line
          x1="8"
          y1="0"
          x2="8"
          y2="100%"
          stroke="#CBD5E1"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {ticks.map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="16"
            y2={y}
            stroke="#CBD5E1"
            strokeWidth="1"
          />
        ))}
      </svg>
      {/* right */}
      <svg
        className="pointer-events-none absolute right-4 top-0 hidden h-full w-4 lg:block"
        aria-hidden="true"
      >
        <line
          x1="8"
          y1="0"
          x2="8"
          y2="100%"
          stroke="#CBD5E1"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {ticks.map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="16"
            y2={y}
            stroke="#CBD5E1"
            strokeWidth="1"
          />
        ))}
      </svg>
    </>
  );
}

/* ── Hero ────────────────────────────────────────────────────── */
export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      className="relative overflow-hidden border-b border-[#E2E8F0]"
      style={{
        background:
          "radial-gradient(circle at 12% 12%, rgba(26,86,219,0.16), transparent 34%), radial-gradient(circle at 86% 10%, rgba(249,115,22,0.18), transparent 30%), radial-gradient(circle at 50% 82%, rgba(6,182,212,0.12), transparent 34%), linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 72%)",
      }}
    >
      {/* floating gradient orbs */}
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? undefined : { opacity: [0.65, 0.9, 0.65] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-[8%] top-[10%] h-40 w-40 transform-gpu rounded-full bg-[radial-gradient(circle,rgba(26,86,219,0.18)_0%,rgba(26,86,219,0)_72%)] will-change-opacity"
      />
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? undefined : { opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute right-[10%] top-[16%] h-44 w-44 transform-gpu rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.16)_0%,rgba(249,115,22,0)_74%)] will-change-opacity"
      />

      {/* grid lines */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />

      {/* side markers */}
      <SideMarkers />

      {/* content */}
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-16 text-center lg:px-8 lg:pb-24 lg:pt-24">
        <motion.div initial="hidden" animate="visible" variants={stagger}>
          <motion.div
            variants={fadeUp}
            className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-xs font-semibold text-[#1A56DB] shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Intelligent cloud and AI observability for engineering teams
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.04] tracking-tight text-[#020617] sm:text-6xl lg:text-7xl"
          >
            Take command of your cloud and AI infrastructure spend
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#475569] sm:text-lg"
          >
            Cloudcam unites multi-cloud monitoring, cloud cost optimization,
            and multi-provider AI observability into a single, developer-first FinOps
            workspace. Spot anomalies, right-size workloads, and trace LLM usage
            costs in real time before your budget drifts.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <motion.div whileHover={{ scale: 0.98 }} whileTap={{ scale: 0.96 }}>
              <Button
                asChild
                size="lg"
                className="h-12 bg-[#1A56DB] px-6 text-white hover:bg-[#1040A0]"
              >
                <Link href="/signup">
                  Book a demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-6 text-sm font-bold text-[#0F172A] shadow-sm transition-colors hover:bg-[#F8FAFC]"
            >
              Sign up for free
            </Link>
          </motion.div>
        </motion.div>

        <DashboardMockup />
      </div>
    </section>
  );
}
