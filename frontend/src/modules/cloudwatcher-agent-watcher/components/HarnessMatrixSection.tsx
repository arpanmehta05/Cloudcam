"use client";

import { useMemo } from "react";
import { CheckCircle2, Clock3, FileSearch, ShieldAlert, XCircle } from "@/icons";
import type { ReportDetail } from "../types";
import { summarizeCategories } from "../lib";
import { ScoreGauge } from "./ScoreGauge";

export function HarnessMatrixSection({ report }: { report: ReportDetail }) {
  const categories = useMemo(
    () => summarizeCategories(report.test_results, report.category_scores),
    [report.test_results, report.category_scores],
  );
  const observedCount = report.test_results.length;
  const failingCount = categories.reduce((total, category) => total + category.failed, 0);
  const reviewCount = categories.reduce((total, category) => total + category.manualReview + category.notRun, 0);
  const weakEvidenceCount = categories.filter((category) => category.failed === 0 && category.manualReview + category.notRun === 0 && category.ratio < 0.7).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCE3EC] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#64748B]">Risk posture</p>
          <p className="mt-2 text-lg font-extrabold tracking-tight text-[#0F172A]">What the audit could establish</p>
        </div>
        <span className="rounded-full border border-[#DCE3EC] bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#475569]">{observedCount} observed check{observedCount === 1 ? "" : "s"}</span>
      </div>

      <div className="grid lg:grid-cols-[270px_1fr]">
        <div className="flex flex-col items-center justify-center border-b border-[#E2E8F0] bg-[#FAFBFC] px-6 py-7 lg:border-b-0 lg:border-r">
          <ScoreGauge score01={report.score ?? 0} size={158} />
          <p className="mt-2 max-w-44 text-center text-xs leading-5 text-[#64748B]">Evidence-adjusted health score</p>
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <Metric label="Act now" value={String(failingCount)} tone={failingCount ? "rose" : "slate"} />
            <Metric label="Validate" value={String(reviewCount + weakEvidenceCount)} tone={reviewCount + weakEvidenceCount ? "amber" : "slate"} />
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#94A3B8]">Control coverage</p>
              <p className="mt-1 text-sm font-semibold text-[#334155]">Status by evidence area</p>
            </div>
            {failingCount > 0 ? <ShieldAlert className="h-5 w-5 text-[#0F172A]" /> : <FileSearch className="h-5 w-5 text-[#93C5FD]" />}
          </div>
          {categories.length ? (
            <div className="space-y-3">
              {categories.map((category) => {
                const hasWeakEvidence = category.ratio < 0.7;
                const status = category.failed > 0 ? "issue" : category.manualReview + category.notRun > 0 || hasWeakEvidence ? "review" : "clear";
                const StatusIcon = status === "issue" ? XCircle : status === "review" ? Clock3 : CheckCircle2;
                const style = status === "issue" ? "border-[#0F172A] bg-white text-[#0F172A]" : status === "review" ? "border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]" : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1A56DB]";
                const detail = category.failed > 0
                  ? `${category.failed} failed check${category.failed === 1 ? "" : "s"} needs action`
                  : category.manualReview + category.notRun > 0
                    ? `${category.manualReview + category.notRun} check${category.manualReview + category.notRun === 1 ? "" : "s"} lacks conclusive evidence`
                    : hasWeakEvidence
                      ? `${Math.round(category.ratio * 100)}% evidence strength — passing checks need stronger supporting proof`
                    : `${category.passed} observed check${category.passed === 1 ? "" : "s"} passed`;
                return (
                  <div key={category.category} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3.5 transition-colors hover:border-[#BFDBFE] hover:bg-[#FAFCFF]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${style}`}><StatusIcon className="h-4 w-4" /></span>
                      <div><p className="text-sm font-extrabold capitalize text-[#0F172A]">{category.category.replace(/[_-]/g, " ")}</p><p className="mt-0.5 text-xs text-[#64748B]">{detail}</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold tabular-nums text-[#64748B]">{Math.round(category.ratio * 100)}% strength</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${style}`}>{status === "issue" ? "Needs action" : status === "review" ? "Evidence gap" : "Verified"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyEvidence />}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "rose" | "amber" | "slate" }) {
  const toneClass = tone === "rose" ? "text-[#0F172A]" : tone === "amber" ? "text-[#475569]" : "text-[#334155]";
  return <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</p><p className={`mt-1 text-lg font-extrabold ${toneClass}`}>{value}</p></div>;
}

function EmptyEvidence() {
  return <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-5 py-8 text-center text-sm text-[#64748B]">This run did not submit category-level evidence.</div>;
}
