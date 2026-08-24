"use client";

import { Gauge, ShieldAlert, TrendingDown, XCircle } from "@/icons";
import type { DeepReport } from "../reportData";
import type { ReportDetail } from "../types";
import { SectionShell, SectionHead, CountPill } from "./primitives";

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}`;
}

export function ScoreIntegrity({ report, deep }: { report: ReportDetail; deep: DeepReport }) {
  const hasCap = report.applied_score_cap !== null;
  const hasContent =
    hasCap || deep.criticalGaps.length > 0 || deep.scoreCaps.length > 0 || deep.doNotBuildYet.length > 0;
  if (!hasContent) return null;

  const rawBefore = report.raw_score_before_cap;
  const capped = report.applied_score_cap;

  return (
    <SectionShell padded={false}>
      <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <SectionHead
          eyebrow="Score integrity"
          title="Why the score is capped where it is"
          sub="CloudWatcher fails closed: a missing critical control ceilings the score no matter how many other checks pass. This is the audit trail behind the number."
          icon={Gauge}
          accent="#0F172A"
          right={hasCap ? <CountPill tone="slate">Cap applied</CountPill> : undefined}
        />
      </div>

      {hasCap && (
        <div className="grid gap-px bg-[#E2E8F0] sm:grid-cols-3">
          <CapMetric label="Evidence score (uncapped)" value={pct(rawBefore)} tone="text-[#334155]" note="Before harness caps" />
          <CapMetric label="Score ceiling" value={pct(capped)} tone="text-[#0F172A]" note="Imposed by critical gap" icon />
          <CapMetric label="Reported score" value={pct(report.score)} tone="text-[#1A56DB]" note="Final published score" />
        </div>
      )}

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#0F172A]">
            <ShieldAlert className="h-3.5 w-3.5" /> Critical gaps driving the cap
          </p>
          {deep.criticalGaps.length ? (
            <ul className="mt-3 space-y-2">
              {deep.criticalGaps.map((gap, index) => (
                <li key={index} className="flex items-start gap-2.5 rounded-lg border border-[#E7ECF2] bg-[#FAFBFC] px-3.5 py-2.5">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#0F172A]" />
                  <span className="text-sm font-semibold leading-5 text-[#334155]">{gap}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#64748B]">No critical gaps were recorded for this run.</p>
          )}
        </div>

        <div>
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#475569]">
            <TrendingDown className="h-3.5 w-3.5" /> Applied score caps
          </p>
          {deep.scoreCaps.length ? (
            <ul className="mt-3 space-y-2">
              {deep.scoreCaps.map((cap, index) => (
                <li key={index} className="rounded-lg border border-[#E7ECF2] bg-[#FAFBFC] px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-extrabold capitalize text-[#0F172A]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#0F172A]" />
                      {cap.area ? cap.area.replace(/[_-]/g, " ") : `Cap ${index + 1}`}
                    </span>
                    {cap.cap !== null && (
                      <span className="rounded-md border border-[#E2E8F0] bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#334155]">
                        ≤ {Math.round(cap.cap * 100)}
                      </span>
                    )}
                  </div>
                  {cap.reason && <p className="mt-1.5 text-xs leading-5 text-[#64748B]">{cap.reason}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#64748B]">
              {hasCap ? "A cap was applied but no per-cap breakdown was submitted." : "No explicit caps were declared."}
            </p>
          )}
        </div>
      </div>

      {deep.doNotBuildYet.length > 0 && (
        <div className="border-t border-[#E2E8F0] bg-[#FAFBFC] p-5 sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#64748B]">Deliberately out of scope — do not build yet</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deep.doNotBuildYet.map((item, index) => (
              <span key={index} className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569]">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function CapMetric({ label, value, tone, note, icon }: { label: string; value: string; tone: string; note: string; icon?: boolean }) {
  return (
    <div className="bg-white px-6 py-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#94A3B8]">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl font-extrabold tracking-tight tabular-nums ${tone}`}>{value}</span>
        <span className="text-sm font-bold text-[#CBD5E1]">/100</span>
        {icon && <TrendingDown className="ml-1 h-4 w-4 text-[#0F172A]" />}
      </div>
      <p className="mt-1 text-xs text-[#64748B]">{note}</p>
    </div>
  );
}
