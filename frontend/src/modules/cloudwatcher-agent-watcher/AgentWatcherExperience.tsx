"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  FileText,
  Loader2,
  Radar,
  ShieldCheck,
  Activity,
} from "@/icons";

import { AuthModal } from "./components/AuthModal";
import { ReportView } from "./components/ReportView";
import { AgentWatcherFooter } from "./components/AgentWatcherFooter";
import { AuditSetupPanel } from "./components/AuditSetupPanel";
import { downloadReportPdf, ensureReportsIngestKey, revokeReportsIngestKey } from "./api";
import { useAgents, useReport } from "./hooks";

const NAV_LINKS = [
  { label: "Platform", href: "/#platform" },
  { label: "AI", href: "/#ai" },
  { label: "Agent Watcher", href: "/agent-watcher" },
  { label: "Plans", href: "/plans" },
  { label: "Docs", href: "/docs" },
];

interface KeyState {
  token: string | null;
  prefix: string | null;
  loading: boolean;
  error: string | null;
}

const RUN_STARTED_KEY = "aw_run_started";

// ─── Demo harness rows shown in the hero card ──────────────────────────────


const AUDIT_STEPS = [
  { icon: Clipboard, title: "Copy one prompt", body: "Start the audit from the coding agent that already knows your repository." },
  { icon: Radar, title: "Inspect the evidence", body: "The agent maps the controls, probes, and safeguards it can actually verify." },
  { icon: FileText, title: "Get a useful report", body: "Review evidence, score caps, and a prioritized remediation roadmap." },
];

export function AgentWatcherExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [promptRequested, setPromptRequested] = useState(searchParams.get("prompt") === "1");
  // Persist the run-start time so a page refresh mid-audit doesn't reset it to
  // "now" — otherwise a report the agent already submitted would fall outside
  // the detection window and never auto-appear.
  const [runStartedAt, setRunStartedAt] = useState<number>(() => {
    if (searchParams.get("prompt") !== "1") return 0;
    if (typeof window === "undefined") return Date.now();
    const stored = Number(window.sessionStorage.getItem(RUN_STARTED_KEY));
    if (Number.isFinite(stored) && stored > 0) return stored;
    const now = Date.now();
    try { window.sessionStorage.setItem(RUN_STARTED_KEY, String(now)); } catch {}
    return now;
  });
  const [activeReportId, setActiveReportId] = useState<string | null>(searchParams.get("report_id"));
  const [keyState, setKeyState] = useState<KeyState>({ token: null, prefix: null, loading: false, error: null });
  const [authOpen, setAuthOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const keyRequested = useRef(false);
  const revokeStarted = useRef(false);

  const [agentId] = useState("my-agent-id");
  const [agentName] = useState("v2.4.0_enterprise_hardened");
  const [reportName] = useState("system_context_active");
  const [activeTab, setActiveTab] = useState<"prompt" | "report">("prompt");

  useEffect(() => {
    if (activeReportId) {
      setActiveTab("report");
    }
  }, [activeReportId]);

  const path = "/agent-watcher";

  const updateQuery = useCallback(
    (next: { prompt?: boolean; report_id?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.prompt !== undefined) {
        if (next.prompt) params.set("prompt", "1");
        else params.delete("prompt");
      }
      if (next.report_id !== undefined) {
        if (next.report_id) params.set("report_id", next.report_id);
        else params.delete("report_id");
      }
      const qs = params.toString();
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    },
    [router, searchParams],
  );

  const beginRun = useCallback(() => {
    const now = Date.now();
    setRunStartedAt(now);
    if (typeof window !== "undefined") {
      try { window.sessionStorage.setItem(RUN_STARTED_KEY, String(now)); } catch {}
    }
  }, []);

  const provisionKey = useCallback(async () => {
    setKeyState({ token: null, prefix: null, loading: true, error: null });
    try {
      const { token, prefix } = await ensureReportsIngestKey();
      setKeyState({ token, prefix, loading: false, error: null });
    } catch (err: any) {
      setKeyState({ token: null, prefix: null, loading: false, error: err?.message || "Couldn't provision an ingest key." });
    }
  }, []);

  useEffect(() => {
    if (user && promptRequested && !keyRequested.current) {
      keyRequested.current = true;
      provisionKey();
    }
  }, [user, promptRequested, provisionKey]);

  const handleGetPrompt = useCallback(() => {
    if (!user) { setAuthOpen(true); return; }
    setPromptRequested(true);
    beginRun();
    updateQuery({ prompt: true });
    if (!keyRequested.current) { keyRequested.current = true; provisionKey(); }
  }, [beginRun, provisionKey, updateQuery, user]);

  const handleNewRun = useCallback(() => {
    if (!user) { setAuthOpen(true); return; }
    revokeStarted.current = false;
    keyRequested.current = true;
    setPdfError(null);
    setActiveReportId(null);
    setPromptRequested(true);
    beginRun();
    updateQuery({ prompt: true, report_id: null });
    setActiveTab("prompt");
    provisionKey();
  }, [beginRun, provisionKey, updateQuery, user]);

  const handleDownloadPdf = useCallback(async () => {
    if (!activeReportId) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const blob = await downloadReportPdf(activeReportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cloudwatcher-agent-report-${activeReportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setPdfError(err?.message || "Could not generate the PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [activeReportId]);

  const agentsState = useAgents(!!user);
  const reportState = useReport(activeReportId);

  useEffect(() => {
    if (activeReportId || !promptRequested) return;
    const latest = agentsState.data
      ?.map((agent) => agent.latest_report)
      .filter(Boolean)
      .filter((report) => Date.parse(report!.submitted_at) >= runStartedAt - 60_000)
      .sort((a, b) => Date.parse(b!.submitted_at) - Date.parse(a!.submitted_at))[0];
    if (latest?.report_id) {
      setActiveReportId(latest.report_id);
      updateQuery({ report_id: latest.report_id });
    }
  }, [activeReportId, agentsState.data, promptRequested, runStartedAt, updateQuery]);

  useEffect(() => {
    const report = reportState.data;
    if (!report || report.status === "pending_score" || revokeStarted.current) return;
    revokeStarted.current = true;
    revokeReportsIngestKey(keyState.prefix)
      .then(() => { setKeyState((s) => ({ ...s, token: null, prefix: null })); })
      .catch(() => { revokeStarted.current = false; });
  }, [keyState.prefix, reportState.data]);

  const showPrompt = !!user && promptRequested;

  const report = reportState.data;
  const displayId = report ? `AW-${report.report_id.slice(-6).toUpperCase()}` : "AW-8842-X";
  const displayStatus = report ? (report.status === "pending_score" ? "SCANNING" : "STABLE") : "STABLE";
  const displayScore = report?.score !== null && report?.score !== undefined ? Math.round(report.score * 100) : 62;

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#0F172A]">
      <Navbar
        links={NAV_LINKS}
        secondaryLink={user ? { label: "Dashboard", href: "/dashboard" } : { label: "Sign in", href: "/login" }}
        cta={user ? undefined : { label: "Start free", href: "/signup" }}
      />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        {!showPrompt && <section className="relative overflow-hidden border-b border-[#E2E8F0] bg-white">
          {/* Subtle grid */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.025)_1px,transparent_1px)] bg-[size:52px_52px]" />
          {/* Radial glow — top left */}
          <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(59,111,239,0.08),transparent_70%)]" />

          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-14 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:pb-20 lg:pt-20">
            {/* Left — copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col justify-center"
            >
              <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.06] tracking-tight text-[#020617] sm:text-5xl lg:text-[58px]">
                Audit the agent{" "}<span className="text-[#1A56DB]">before it ships.</span>
              </h1>

              <p className="mt-6 max-w-lg text-[17px] leading-7 text-[#475569]">
                Give your coding agent one focused prompt. It inspects the AI surface in your repository and returns a board-ready audit — 13 harness controls classified, every gap tied to evidence, and a score that fails closed on missing critical controls.
              </p>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#475569]">
                {["No questionnaire", "Evidence-adjusted scoring", "Key auto-revoked"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1A56DB]" />{item}</span>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  id="hero-get-prompt"
                  onClick={handleGetPrompt}
                  disabled={authLoading || keyState.loading}
                  className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[#1A56DB] px-7 text-sm font-bold text-white shadow-[0_4px_20px_rgba(26,86,219,0.28)] transition-all hover:bg-[#1040A0] hover:shadow-[0_6px_28px_rgba(26,86,219,0.38)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {keyState.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clipboard className="h-4 w-4" />
                  )}
                  Start an audit
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <Link
                  href="/docs"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-7 text-sm font-bold text-[#334155] transition-colors hover:bg-[#F8FAFC]"
                >
                  Documentation
                </Link>
              </div>
            </motion.div>

            {/* Right — live report score card */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center lg:justify-end"
            >
              <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#EFF6FF]"><ShieldCheck className="h-4 w-4 text-[#1A56DB]" /></span>
                    <div><p className="text-sm font-bold text-[#0F172A]">Agent audit report</p><p className="text-[11px] text-[#64748B]">{report ? `Report ${displayId}` : "Example output"}</p></div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${displayStatus === "SCANNING" ? "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]" : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1A56DB]"}`}><span className={`h-1.5 w-1.5 rounded-full ${displayStatus === "SCANNING" ? "bg-[#94A3B8] animate-pulse" : "bg-[#1A56DB]"}`} />{displayStatus === "SCANNING" ? "RUNNING" : "READY"}</span>
                </div>
                <div className="grid gap-5 p-5 sm:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-xl bg-[#F8FAFC] p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Evidence score</p>
                    <div className="mt-2 flex items-baseline gap-1"><span className="text-5xl font-extrabold tracking-tight text-[#1A56DB]">{displayScore}</span><span className="text-sm font-bold text-[#94A3B8]">/ 100</span></div>
                    <p className="mt-2 text-xs leading-5 text-[#64748B]">Capped by the weakest critical control — not an average.</p>
                  </div>
                  <div className="py-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Harness coverage</p>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {[
                        ["Input handling", "#1A56DB"],
                        ["Output validation", "#1A56DB"],
                        ["Observability", "#94A3B8"],
                        ["Evaluation", "#94A3B8"],
                        ["Security", "#1A56DB"],
                        ["Deployment ops", "#0F172A"],
                      ].map(([label, color]) => (
                        <div key={label} className="flex items-center gap-1.5 rounded-md border border-[#EEF2F6] bg-white px-2 py-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate text-[10px] font-bold text-[#475569]">{label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5 flex items-center gap-3 text-[10px] font-semibold text-[#94A3B8]">
                      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#1A56DB]" />Present</span>
                      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]" />Partial</span>
                      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#0F172A]" />Missing</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>}

        {showPrompt && (
          <section className="border-b border-[#E2E8F0] bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 lg:px-6 lg:py-10">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#94A3B8]">Agent Watcher</p><h1 className="mt-1 text-xl font-extrabold tracking-tight text-[#0F172A]">Audit workspace</h1></div>
              <div className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5"><span className={`h-2 w-2 rounded-full ${report?.status === "pending_score" ? "bg-[#94A3B8] animate-pulse" : "bg-[#1A56DB]"}`} /><span className="font-mono text-xs font-bold text-[#475569]">{report ? displayId : "RUN INITIALIZED"}</span></div>
            </div>
          </section>
        )}

        {/* ── Metadata Bar ── */}
        {!showPrompt && !reportState.data && (
          <section className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-10 lg:px-6 lg:py-14">
            <div className="mx-auto max-w-7xl">
              <p className="text-sm font-bold text-[#1A56DB]">A deliberately small workflow</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">A clear audit trail, not another dashboard.</h2>
                <p className="max-w-sm text-sm leading-6 text-[#64748B]">What can you prove, what is missing, and what should change next.</p>
              </div>
              <div className="mt-9 grid gap-4 md:grid-cols-3">
                {AUDIT_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <article key={step.title} className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#EFF6FF] text-[#1A56DB]"><Icon className="h-4 w-4" /></span><span className="font-mono text-xs font-bold text-[#94A3B8]">0{index + 1}</span></div>
                      <h3 className="mt-5 text-base font-extrabold text-[#0F172A]">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#64748B]">{step.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Tabs Selector ── */}
        {showPrompt && (
          <div className="border-b border-[#E2E8F0] bg-white px-4 lg:px-6">
            <div className="mx-auto flex max-w-7xl gap-7">
              <button
                type="button"
                onClick={() => setActiveTab("prompt")}
                className={`py-4 text-sm font-bold transition-colors border-b-2 outline-none ${
                  activeTab === "prompt"
                    ? "border-[#1A56DB] text-[#1A56DB]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Run setup
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeReportId || reportState.data) {
                    setActiveTab("report");
                  }
                }}
                disabled={!activeReportId && !reportState.data}
                className={`py-4 text-sm font-bold transition-colors border-b-2 outline-none ${
                  !activeReportId && !reportState.data
                    ? "border-transparent text-[#94A3B8] cursor-not-allowed opacity-50"
                    : activeTab === "report"
                    ? "border-[#1A56DB] text-[#1A56DB]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Report
              </button>
            </div>
          </div>
        )}

        {/* ── Prompt + Report area ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {showPrompt && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {activeTab === "prompt" && (
                <AuditSetupPanel
                  ingestKey={keyState.token}
                  keyLoading={keyState.loading}
                  keyError={keyState.error}
                  expired={!!reportState.data && reportState.data.status !== "pending_score"}
                  onRetryKey={() => { keyRequested.current = true; provisionKey(); }}
                  agentId={agentId}
                  agentName={agentName}
                  reportName={reportName}
                />
              )}

              {activeTab === "report" && (
                <div id="cw-report" className="scroll-mt-24">
                  <section className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
                    {/* Section label */}
                    <div className="mb-5 flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1A56DB] text-xs font-extrabold text-white">
                        2
                      </span>
                      <p className="text-sm font-bold text-[#0F172A]">Your audit result</p>
                    </div>

                    {reportState.error ? (
                      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm text-[#B91C1C]">
                        {reportState.error}
                      </div>
                    ) : reportState.data ? (
                      <>
                        <ReportView report={reportState.data} />
                        {reportState.data.status !== "pending_score" && (
                          <AgentWatcherFooter
                            pdfLoading={pdfLoading}
                            pdfError={pdfError}
                            onDownloadPdf={handleDownloadPdf}
                            onNewRun={handleNewRun}
                          />
                        )}
                      </>
                    ) : activeReportId ? (
                      <div className="h-64 animate-pulse rounded-xl bg-[#F1F5F9]" />
                    ) : (
                      <WaitingForReport />
                    )}
                  </section>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        redirectPath={`${path}?prompt=1`}
        onAuthenticated={() => {
          setPromptRequested(true);
          beginRun();
          updateQuery({ prompt: true });
        }}
      />
    </div>
  );
}

function WaitingForReport() {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-[#DBEAFE] bg-white shadow-sm lg:grid-cols-[0.85fr_1.15fr]">
      <div className="mb-0 flex h-auto min-h-48 items-center justify-center bg-[#F8FAFC] p-10">
        <Activity className="h-6 w-6 animate-pulse text-[#1A56DB]" />
      </div>
      <div className="p-8 sm:p-10">
      <p className="text-xl font-extrabold tracking-tight text-[#0F172A]">Your agent is working.</p>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#64748B]">
        Paste the prompt into your coding agent. The report appears here automatically once submitted — usually 3–8 minutes. Your ingest key is revoked as soon as the report lands.
      </p>
      <div className="mt-7 flex flex-col gap-4 text-left">
        {["Agent inspects your repo", "Runs safety probes", "Posts scored report here"].map((step, i) => (
          <div key={step} className="flex items-center gap-3 text-sm font-medium text-[#475569]">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] text-[10px] font-extrabold text-[#1A56DB]">
              {i + 1}
            </span>
            {step}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}


