"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu } from "@/icons";

import type { EvaluationStats } from "../types";

interface EvaluationStatsCardsProps {
  loading: boolean;
  stats: EvaluationStats;
  selectedJudgeModel: string;
  selectedJudgeProvider: string;
  customJudgeProviderName: string;
}

export function EvaluationStatsCards({
  loading,
  stats,
  selectedJudgeModel,
  selectedJudgeProvider,
  customJudgeProviderName,
}: EvaluationStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="border border-border/80 bg-secondary/5">
        <CardContent className="pt-6">
          <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Total Audited</p>
          {loading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-semibold mt-1">{stats.totalCount}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">10% background sampling rate</p>
        </CardContent>
      </Card>

      <Card className="border border-border/80 bg-secondary/5">
        <CardContent className="pt-6">
          <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Overall Score</p>
          {loading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-semibold mt-1 text-indigo-400">{stats.avgScore}/100</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">Target benchmark â‰¥ 80</p>
        </CardContent>
      </Card>

      <Card className="border border-border/80 bg-secondary/5">
        <CardContent className="pt-6">
          <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Audit Pass Rate</p>
          {loading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className={`text-3xl font-semibold mt-1 ${stats.passRate >= 85 ? "text-emerald-400" : "text-amber-400"}`}>
              {stats.passRate}%
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">Target pass rate â‰¥ 90%</p>
        </CardContent>
      </Card>

      <Card className="border border-border/80 bg-secondary/5">
        <CardContent className="pt-6">
          <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Judge Model</p>
          <div className="flex items-center gap-1.5 mt-2.5 min-w-0">
            <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-sm font-semibold font-mono truncate capitalize">
              {selectedJudgeModel}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2.5 truncate uppercase">
            Provider: {selectedJudgeProvider === "custom" ? customJudgeProviderName || "custom" : selectedJudgeProvider}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
