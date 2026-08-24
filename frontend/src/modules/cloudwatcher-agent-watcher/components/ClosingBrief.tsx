"use client";

import { ArrowRight, Lightbulb, Search } from "@/icons";
import type { DeepReport } from "../reportData";
import { SectionShell, SectionHead } from "./primitives";

export function ClosingBrief({ deep }: { deep: DeepReport }) {
  if (!deep.finalRecommendations.length && !deep.openQuestions.length) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {deep.finalRecommendations.length > 0 && (
        <SectionShell>
          <SectionHead
            eyebrow="Final recommendations"
            title="What we would do first"
            icon={Lightbulb}
            accent="#1A56DB"
          />
          <ol className="mt-5 space-y-2.5">
            {deep.finalRecommendations.map((item, index) => (
              <li key={index} className="flex items-start gap-3 rounded-xl border border-[#DBEAFE] bg-[#F8FAFF] px-4 py-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1A56DB] text-[11px] font-extrabold text-white">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold leading-6 text-[#1E293B]">{item}</span>
                <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-[#93C5FD]" />
              </li>
            ))}
          </ol>
        </SectionShell>
      )}

      {deep.openQuestions.length > 0 && (
        <SectionShell>
          <SectionHead
            eyebrow="Open questions"
            title="What the audit could not resolve"
            sub="Decisions that need a human owner before the harness plan is final."
            icon={Search}
            accent="#64748B"
          />
          <ul className="mt-5 space-y-2.5">
            {deep.openQuestions.map((item, index) => (
              <li key={index} className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] px-4 py-3">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#CBD5E1] text-[10px] font-extrabold text-[#64748B]">
                  ?
                </span>
                <span className="text-sm leading-6 text-[#475569]">{item}</span>
              </li>
            ))}
          </ul>
        </SectionShell>
      )}
    </div>
  );
}
