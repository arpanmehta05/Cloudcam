"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle, AlertTriangle } from "@/icons";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import type { Diagnosis, Optimization } from "./types";

interface StatusSidebarProps {
  visibleDiagnosis: Diagnosis[];
  visibleOptimizations: Optimization[];
}

function providerBadge(provider: Diagnosis["provider"]) {
  const copy = getProviderCopy(provider);
  return (
    <span className="inline-flex items-center rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
      {copy.shortLabel}
    </span>
  );
}

export function StatusSidebar({
  visibleDiagnosis,
  visibleOptimizations,
}: StatusSidebarProps) {
  return (
    <aside className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#1A56DB]" />
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#0F172A] dark:text-white">
            Status
          </h2>
        </div>
        <div className="space-y-3">
          {visibleDiagnosis.map((diag, index) => (
            <div
              key={`${diag.provider}-${diag.title}-${index}`}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#24344D] dark:bg-[#07111F]"
            >
              <div className="mb-2">{providerBadge(diag.provider)}</div>
              <div className="flex items-center gap-2">
                {diag.status === "healthy" ? (
                  <CheckCircle className="h-4 w-4 text-[#22C55E]" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-[#F97316]" />
                )}
                <p className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  {diag.title}
                </p>
              </div>
              <p className="mt-1 line-clamp-3 text-xs font-medium leading-5 text-[#64748B] dark:text-[#94A3B8]">
                {diag.details}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {visibleOptimizations.length ? (
        <Card className="p-4">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#0F172A] dark:text-white">
            Optimization opportunities
          </h2>
          <div className="mt-3 space-y-3">
            {visibleOptimizations.slice(0, 8).map((opt) => (
              <div
                key={opt.id}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#24344D] dark:bg-[#07111F]"
              >
                <div className="mb-2">{providerBadge(opt.provider)}</div>
                <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  {opt.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#64748B] dark:text-[#94A3B8]">
                  {opt.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{opt.priority}</Badge>
                  <Badge variant="outline">{opt.effort}</Badge>
                  {opt.savings ? <Badge variant="outline">Save {opt.savings}</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </aside>
  );
}
