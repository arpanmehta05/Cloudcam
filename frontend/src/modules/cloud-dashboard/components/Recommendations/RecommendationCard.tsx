"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ChevronRight, Zap, Boxes, Loader2 } from "@/icons";
import { getProviderCopy } from "@/lib/cloud/provider-status";
import type { Recommendation } from "./types";

interface RecommendationCardProps {
  rec: Recommendation;
  planningRec: string | null;
  handlePlanAction: (rec: Recommendation) => void;
  handleImplementPlan: (rec: Recommendation) => void;
  handleDismiss: (id: string) => void;
}

const impactTone: Record<Recommendation["impact"], string> = {
  high: "border-l-[#EF4444] bg-[#FEF2F2]/70 dark:bg-[#3B1218]/40",
  medium: "border-l-[#F97316] bg-[#FFF7ED]/70 dark:bg-[#3A1F0B]/40",
  low: "border-l-[#22C55E] bg-[#F0FDF4]/70 dark:bg-[#052E16]/35",
};

function providerBadge(provider: Recommendation["provider"]) {
  const copy = getProviderCopy(provider);
  return (
    <span className="inline-flex items-center rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
      {copy.shortLabel}
    </span>
  );
}

export function RecommendationCard({
  rec,
  planningRec,
  handlePlanAction,
  handleImplementPlan,
  handleDismiss,
}: RecommendationCardProps) {
  const isPlanning = planningRec === rec.id;

  return (
    <Card className={`border-l-4 p-4 ${impactTone[rec.impact]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {providerBadge(rec.provider)}
            <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
              {rec.title}
            </h3>
            <Badge variant="secondary">{rec.impact}</Badge>
            <Badge variant="outline">{rec.category}</Badge>
            {rec.savings ? <Badge variant="outline">Save {rec.savings}</Badge> : null}
          </div>
          <p className="text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
            {rec.description}
          </p>
          {rec.resourceId ? (
            <p
              className="mt-2 truncate text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]"
              title={rec.resourceId}
            >
              Resource: {rec.resourceId}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[#64748B] dark:text-[#94A3B8]">
              <ChevronRight className="h-3.5 w-3.5" />
              {rec.action}
            </span>
            {rec.provider === "aws" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => handlePlanAction(rec)} disabled={isPlanning}>
                  {isPlanning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Plan action
                </Button>
                <Button size="sm" variant="default" onClick={() => handleImplementPlan(rec)} disabled={isPlanning}>
                  {isPlanning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Boxes className="mr-1 h-3.5 w-3.5" />
                  )}
                  Implement Plan
                </Button>
              </>
            ) : (
              <Badge variant="secondary">Provider-console review</Badge>
            )}
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => handleDismiss(rec.id)}
          aria-label="Dismiss recommendation"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
