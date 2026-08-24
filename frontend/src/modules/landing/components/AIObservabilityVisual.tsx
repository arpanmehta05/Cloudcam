"use client";

import { Bot, Sparkles, Tag, Check } from "@/icons";

export function AIObservabilityVisual() {
  return (
    <div className="rounded-2xl border border-[#DBEAFE] bg-[linear-gradient(135deg,#FFFFFF_0%,#EFF6FF_62%,#FFF7ED_100%)] p-5 shadow-sm">
      {/* pipeline steps */}
      <div className="grid grid-cols-4 gap-3">
        {(
          [
            { label: "Capture", title: "Requests", icon: Bot, color: "#1A56DB" },
            { label: "Explain", title: "Patterns", icon: Sparkles, color: "#06B6D4" },
            { label: "Assign", title: "Owners", icon: Tag, color: "#F97316" },
            { label: "Act", title: "Workflows", icon: Check, color: "#22C55E" },
          ] as const
        ).map((step) => (
          <div
            key={step.title}
            className="rounded-xl border border-white/80 bg-white/60 p-3 shadow-sm"
          >
            <div
              className="mb-2 flex h-8 w-8 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: step.color }}
            >
              <step.icon className="h-4 w-4" />
            </div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#64748B]">
              {step.label}
            </p>
            <p className="mt-1 text-sm font-extrabold text-[#0F172A]">
              {step.title}
            </p>
          </div>
        ))}
      </div>

      {/* insight bar */}
      <div className="mt-4 rounded-xl border border-white/80 bg-white/70 p-4 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1A56DB]">
          AI insight generated
        </p>
        <p className="mt-2 text-sm font-extrabold leading-5 text-[#0F172A]">
          AI token growth concentrated in support workflows — no reliability
          regression detected.
        </p>
      </div>

      {/* stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {(
          [
            ["AI spend", "$10.5K", "#1A56DB"],
            ["LLM usage", "2.3M", "#F97316"],
            ["Healthy", "99.2%", "#22C55E"],
          ] as const
        ).map(([label, value, color]) => (
          <div
            key={label}
            className="rounded-xl border border-white/80 bg-white/70 p-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-[#64748B]">{label}</p>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
            <p className="mt-1 text-lg font-extrabold text-[#0F172A]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
