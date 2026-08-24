"use client";

import { Building2, Cpu, GitBranch, Layers, ShieldAlert, TrendingUp } from "@/icons";
import type { DeepReport } from "../reportData";
import type { ReportDetail } from "../types";
import { SYSTEM_TYPE_MAP } from "../constants";
import { SectionShell } from "./primitives";

const CONFIDENCE_DOT: Record<string, string> = {
  high: "bg-[#1A56DB]",
  medium: "bg-[#94A3B8]",
  low: "bg-[#0F172A]",
};

export function ExecutiveBrief({ report, deep }: { report: ReportDetail; deep: DeepReport }) {
  const summary = deep.executiveSummary || deep.rawSummary;
  const systemMeta = SYSTEM_TYPE_MAP[report.system_type];
  const facts = [
    { icon: Layers, label: "System type", value: systemMeta?.label ?? report.system_type },
    { icon: Cpu, label: "Model", value: deep.target.model || "Not disclosed" },
    { icon: Building2, label: "Environment", value: deep.target.environment || "Unspecified" },
    { icon: GitBranch, label: "Repository", value: deep.target.repository || "Private" },
    { icon: TrendingUp, label: "Maturity", value: deep.target.maturity || "Unstated" },
  ];

  if (!summary && !deep.target.model && !deep.target.environment) return null;

  return (
    <SectionShell padded={false}>
      <div className="grid lg:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0 border-b border-[#E2E8F0] p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#1A56DB]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1A56DB]" />
            Executive summary
          </div>
          {summary ? (
            <div className="mt-4 space-y-3">
              {summary
                .split(/\n\s*\n/)
                .filter((paragraph) => paragraph.trim())
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line break-words text-[15px] leading-7 text-[#334155]">
                    {paragraph.trim()}
                  </p>
                ))}
            </div>
          ) : (
            <p className="mt-4 text-[15px] leading-7 text-[#64748B]">
              The audit did not submit a narrative executive summary. The evidence, taxonomy coverage, and findings
              below still describe the full posture of the system.
            </p>
          )}

          {deep.criticalMissing.length > 0 && (
            <div className="mt-6 rounded-xl border border-[#E7ECF2] bg-[#FAFBFC] px-4 py-3.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#64748B]">
                  {deep.criticalMissing.length} critical area{deep.criticalMissing.length === 1 ? "" : "s"} not fully in place
                </p>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {deep.criticalMissing.map((area) => (
                  <span
                    key={area.key}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#E7ECF2] bg-white px-2 py-1 text-xs font-bold text-[#334155]"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${area.status === "missing" ? "bg-[#0F172A]" : "bg-[#94A3B8]"}`} />
                    {area.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 bg-[#FAFBFC] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#94A3B8]">Audit target</p>
            {deep.evidenceConfidence && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7ECF2] bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#475569]">
                <span className={`h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT[deep.evidenceConfidence]}`} />
                {deep.evidenceConfidence} confidence
              </span>
            )}
          </div>
          <p className="mt-3 break-words font-mono text-sm font-bold text-[#0F172A]">{deep.target.name}</p>
          <dl className="mt-5 space-y-3">
            {facts.map((fact) => {
              const Icon = fact.icon;
              return (
                <div key={fact.label} className="border-b border-[#EEF2F6] pb-3 last:border-0 last:pb-0">
                  <dt className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#94A3B8]">
                    <Icon className="h-3 w-3 text-[#94A3B8]" />
                    {fact.label}
                  </dt>
                  <dd className="mt-1 break-words text-[13px] font-bold leading-5 text-[#334155]">
                    {fact.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </SectionShell>
  );
}
