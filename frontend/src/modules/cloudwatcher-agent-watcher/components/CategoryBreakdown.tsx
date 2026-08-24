"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "@/icons";
import { scoreBand } from "../constants";
import type { CategorySummary } from "../types";
import { InfoHint } from "./InfoHint";

export function CategoryBreakdown({ categories }: { categories: CategorySummary[] }) {
  if (categories.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#FAFCFF] p-5 text-sm text-[#94A3B8]">
        No scored categories yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((cat, i) => {
        const band = scoreBand(cat.ratio);
        const pct = Math.round(cat.ratio * 100);
        return (
          <motion.div
            key={cat.category}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.35, delay: i * 0.04, ease: [0.2, 0, 0.2, 1] }}
            className="rounded-xl border border-[#F1F5F9] bg-[#FAFCFF] p-4"
          >
            {/* Top row: name + score */}
            <div className="flex items-center justify-between gap-4">
              <p className="truncate text-sm font-bold capitalize text-[#0F172A]">
                {cat.category.replace(/[_-]/g, " ")}
              </p>
              <span className="shrink-0 text-lg font-extrabold tabular-nums" style={{ color: band.color }}>
                {pct}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E8EDF3]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${band.ring}, ${band.color})` }}
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.65, delay: 0.1 + i * 0.04, ease: [0.2, 0, 0.2, 1] }}
              />
            </div>

            {/* Result mix — compact chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip icon={CheckCircle2} label="Pass" value={cat.passed} color="#15803D" />
              <Chip icon={XCircle} label="Fail" value={cat.failed} color="#B91C1C" />
              <Chip icon={AlertTriangle} label="Review" value={cat.manualReview} color="#B45309" />
              <Chip icon={Clock} label="Skip" value={cat.notRun} color="#64748B" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  color: string;
}) {
  if (value === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold ring-1 ring-[#E8EDF3]" style={{ color }}>
      <Icon className="h-3 w-3" />
      {value} {label}
    </span>
  );
}
