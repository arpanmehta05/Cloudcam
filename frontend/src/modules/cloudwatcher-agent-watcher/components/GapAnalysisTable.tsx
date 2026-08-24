"use client";

import { Bug } from "@/icons";
import type { DeepReport } from "../reportData";
import { SEVERITY_ORDER, severityTone } from "../reportData";
import { SectionShell, SectionHead, CountPill } from "./primitives";

export function GapAnalysisTable({ deep }: { deep: DeepReport }) {
  if (!deep.gapAnalysis.length) return null;

  const rows = [...deep.gapAnalysis].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
  const criticalCount = rows.filter((row) => row.severity === "critical" || row.severity === "high").length;

  return (
    <SectionShell padded={false}>
      <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <SectionHead
          eyebrow="Gap analysis"
          title="Each gap, its severity, and how to close it"
          sub="The full owner-ready ledger: where the control is missing, the risk it carries, the fix, and the proof that closes it."
          icon={Bug}
          accent="#0F172A"
          right={<CountPill tone="slate">{criticalCount} high-severity</CountPill>}
        />
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#FAFBFC] text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">
              <th className="px-6 py-3">Area</th>
              <th className="px-4 py-3">Sev.</th>
              <th className="px-4 py-3">Finding</th>
              <th className="px-4 py-3">Recommended action</th>
              <th className="px-6 py-3">Validation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const tone = severityTone(row.severity);
              return (
                <tr key={index} className="border-b border-[#EEF2F6] align-top last:border-0 hover:bg-[#FAFCFF]">
                  <td className="px-6 py-4 align-top">
                    <span className="text-sm font-extrabold capitalize text-[#0F172A] break-words">{row.area ? row.area.replace(/[_-]/g, " ") : "—"}</span>
                    {row.evidence && <p className="mt-1 break-words font-mono text-[11px] text-[#94A3B8]">{row.evidence}</p>}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${tone.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {tone.label}
                    </span>
                  </td>
                  <td className="max-w-[22rem] break-words px-4 py-4 text-sm leading-6 text-[#334155]">{row.finding || "—"}</td>
                  <td className="max-w-[20rem] break-words px-4 py-4 text-sm leading-6 text-[#475569]">{row.action || "—"}</td>
                  <td className="max-w-[16rem] break-words px-6 py-4 text-xs leading-5 text-[#64748B]">{row.validation || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 p-5 lg:hidden">
        {rows.map((row, index) => {
          const tone = severityTone(row.severity);
          return (
            <div key={index} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold capitalize text-[#0F172A]">{row.area ? row.area.replace(/[_-]/g, " ") : "—"}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${tone.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {tone.label}
                </span>
              </div>
              {row.finding && <p className="mt-2 text-sm leading-6 text-[#334155]">{row.finding}</p>}
              {row.action && <p className="mt-2 text-sm leading-6 text-[#475569]"><span className="font-bold text-[#0F172A]">Fix: </span>{row.action}</p>}
              {row.validation && <p className="mt-1.5 text-xs leading-5 text-[#64748B]"><span className="font-bold">Validate: </span>{row.validation}</p>}
              {row.evidence && <p className="mt-2 font-mono text-[11px] text-[#94A3B8]">{row.evidence}</p>}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
