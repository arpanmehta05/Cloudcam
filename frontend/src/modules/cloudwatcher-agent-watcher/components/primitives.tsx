"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "@/icons";

// Shared building blocks for the deep-report sections so every panel reads as
// one system: same card chrome, same bold eyebrow → title → sub rhythm.

export function SectionShell({
  id,
  children,
  className = "",
  padded = true,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 overflow-hidden rounded-2xl border border-[#DCE3EC] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  icon: Icon,
  accent = "#64748B",
  right,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
            style={{ borderColor: `${accent}33`, backgroundColor: `${accent}0F`, color: accent }}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: accent }}>
            {eyebrow}
          </p>
          <h3 className="mt-1.5 text-xl font-extrabold tracking-tight text-[#0F172A]">{title}</h3>
          {sub && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">{sub}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function CountPill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "rose" | "amber" | "blue" | "green" }) {
  const styles: Record<string, string> = {
    slate: "border-[#DCE3EC] bg-[#F8FAFC] text-[#475569]",
    rose: "border-[#FECACA] bg-[#FEF2F2] text-[#B42318]",
    amber: "border-[#FDE68A] bg-[#FFFBEB] text-[#A16207]",
    blue: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
    green: "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${styles[tone]}`}>
      {children}
    </span>
  );
}

/** Monospace path/label list used across surface-evidence panels. */
export function PathChips({ items, accent = "#1A56DB", empty }: { items: string[]; accent?: string; empty?: string }) {
  if (!items.length) {
    return empty ? <p className="text-xs text-[#94A3B8]">{empty}</p> : null;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="max-w-full break-all rounded-md border border-[#E2E8F0] bg-[#FAFBFC] px-2 py-1 font-mono text-[11px] font-semibold text-[#475569]"
          title={item}
        >
          <span style={{ color: accent }}>›</span> {item}
        </span>
      ))}
    </div>
  );
}
