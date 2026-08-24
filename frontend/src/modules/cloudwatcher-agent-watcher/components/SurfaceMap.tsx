"use client";

import { Bot, Boxes, CheckCircle2, Cpu, Database, FileSearch, Network, Rocket, XCircle } from "@/icons";
import type { DeepReport, SurfaceEvidence } from "../reportData";
import { SectionShell, SectionHead, PathChips } from "./primitives";

type SurfaceKey = keyof SurfaceEvidence;

const GROUPS: { key: SurfaceKey; label: string; icon: typeof Cpu; accent: string }[] = [
  { key: "modelCallSites", label: "Model call sites", icon: Cpu, accent: "#1A56DB" },
  { key: "retrievalPaths", label: "Retrieval paths", icon: Database, accent: "#64748B" },
  { key: "toolPaths", label: "Tool / function paths", icon: Bot, accent: "#1A56DB" },
  { key: "chatOrMemoryPaths", label: "Chat & memory paths", icon: Network, accent: "#64748B" },
  { key: "testOrEvalPaths", label: "Test & eval paths", icon: FileSearch, accent: "#1A56DB" },
  { key: "deploymentPaths", label: "Deployment paths", icon: Rocket, accent: "#64748B" },
];

export function SurfaceMap({ deep }: { deep: DeepReport }) {
  const s = deep.surface;
  const activeGroups = GROUPS.filter((group) => s[group.key].length > 0);
  const hasAnything =
    s.filesInspected.length ||
    s.aiSurfaceAreas.length ||
    activeGroups.length ||
    s.existingHarness.length ||
    s.harnessGaps.length;
  if (!hasAnything) return null;

  return (
    <SectionShell padded={false}>
      <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <SectionHead
          eyebrow="Repository & surface evidence"
          title="What the audit actually inspected"
          sub="The map the agent built from your codebase — the files it read and the AI surfaces it traced. This is the ground truth behind every score."
          icon={Boxes}
          accent="#1A56DB"
          right={
            s.filesInspected.length ? (
              <span className="rounded-full border border-[#DCE3EC] bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#475569]">
                {s.filesInspected.length} files inspected
              </span>
            ) : undefined
          }
        />
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {s.aiSurfaceAreas.length > 0 && (
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#64748B]">Detected AI surfaces</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.aiSurfaceAreas.map((area, index) => (
                <span key={index} className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-bold text-[#1D4ED8]">
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {activeGroups.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeGroups.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.key} className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md" style={{ backgroundColor: `${group.accent}14`, color: group.accent }}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-xs font-extrabold text-[#0F172A]">{group.label}</p>
                    <span className="ml-auto text-[11px] font-bold text-[#94A3B8]">{s[group.key].length}</span>
                  </div>
                  <div className="mt-3">
                    <PathChips items={s[group.key]} accent={group.accent} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(s.existingHarness.length > 0 || s.harnessGaps.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {s.existingHarness.length > 0 && (
              <div className="rounded-xl border border-[#E7ECF2] bg-[#FAFBFC] p-4">
                <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#64748B]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#1A56DB]" /> Controls already in place
                </p>
                <ul className="mt-3 space-y-1.5">
                  {s.existingHarness.map((item, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-sm leading-5 text-[#334155]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1A56DB]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {s.harnessGaps.length > 0 && (
              <div className="rounded-xl border border-[#E7ECF2] bg-[#FAFBFC] p-4">
                <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#64748B]">
                  <XCircle className="h-3.5 w-3.5 text-[#0F172A]" /> Controls missing or partial
                </p>
                <ul className="mt-3 space-y-1.5">
                  {s.harnessGaps.map((item, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-sm leading-5 text-[#334155]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0F172A]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {s.filesInspected.length > 0 && (
          <details className="group rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-extrabold uppercase tracking-[0.13em] text-[#64748B]">
              Files inspected ({s.filesInspected.length})
              <span className="text-[#94A3B8] transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="mt-3">
              <PathChips items={s.filesInspected} />
            </div>
          </details>
        )}
      </div>
    </SectionShell>
  );
}
