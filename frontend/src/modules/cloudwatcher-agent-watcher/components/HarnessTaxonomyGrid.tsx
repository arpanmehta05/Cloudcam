"use client";

import { Grid3X3 } from "@/icons";
import type { DeepReport, HarnessStatusOrUnknown } from "../reportData";
import { STATUS_TONE } from "../reportData";
import { SectionShell, SectionHead, CountPill } from "./primitives";

const LEGEND: { status: HarnessStatusOrUnknown; help: string }[] = [
  { status: "present", help: "Implemented & evidenced" },
  { status: "partial", help: "Started, gaps remain" },
  { status: "missing", help: "Not implemented" },
  { status: "not_applicable", help: "Out of scope" },
];

export function HarnessTaxonomyGrid({ deep }: { deep: DeepReport }) {
  const classified = deep.taxonomy.filter((area) => area.status !== "unknown");
  if (!classified.length) return null;

  const { present, partial, missing } = deep.taxonomyCounts;
  const scored = present + partial + missing;
  const coverage = scored > 0 ? Math.round(((present + partial * 0.5) / scored) * 100) : 0;

  return (
    <SectionShell padded={false}>
      <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <SectionHead
          eyebrow="Harness coverage matrix"
          title="Every control the system needs — audited"
          sub="Thirteen harness areas classified from the real codebase. Critical areas carry a marker; a gap in one caps the achievable score."
          icon={Grid3X3}
          accent="#1A56DB"
          right={
            <div className="flex flex-col items-end gap-1.5">
              <CountPill tone="blue">{coverage}% weighted coverage</CountPill>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                {present} present · {partial} partial · {missing} missing
              </span>
            </div>
          }
        />
      </div>

      <div className="grid gap-2.5 p-6 sm:grid-cols-2 sm:p-7 xl:grid-cols-3">
        {deep.taxonomy.map((area) => {
          const tone = STATUS_TONE[area.status];
          const dim = area.status === "not_applicable" || area.status === "unknown";
          return (
            <div
              key={area.key}
              className={`group relative overflow-hidden rounded-xl border bg-white px-4 py-3.5 transition-colors ${
                area.status === "missing" && area.critical
                  ? "border-[#0F172A]"
                  : "border-[#E2E8F0] hover:border-[#CBD5E1]"
              }`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar} ${dim ? "opacity-40" : ""}`} />
              <div className="flex items-start justify-between gap-2 pl-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`truncate text-sm font-extrabold ${dim ? "text-[#94A3B8]" : "text-[#0F172A]"}`}>
                      {area.label}
                    </p>
                    {area.critical && (
                      <span className="shrink-0 rounded bg-[#0F172A] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white">
                        Critical
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-[11px] font-semibold ${tone.text}`}>{tone.label}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${tone.chip}`}>
                  {tone.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E2E8F0] bg-[#FAFBFC] px-5 py-4 sm:px-6">
        {LEGEND.map(({ status, help }) => (
          <span key={status} className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#64748B]">
            <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_TONE[status].bar}`} />
            <span className="font-bold text-[#334155]">{STATUS_TONE[status].label}</span>
            <span className="text-[#94A3B8]">{help}</span>
          </span>
        ))}
      </div>
    </SectionShell>
  );
}
