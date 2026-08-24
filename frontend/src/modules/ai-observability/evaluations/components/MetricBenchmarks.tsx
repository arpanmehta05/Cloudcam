"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { EvaluationStats } from "../types";

interface MetricBenchmarksProps {
  stats: EvaluationStats;
}

export function MetricBenchmarks({ stats }: MetricBenchmarksProps) {
  return (
    <Card className="border border-border/80 bg-secondary/5">
      <CardHeader>
        <CardTitle className="text-sm">Metric Quality Benchmarks</CardTitle>
        <CardDescription className="text-xs">Category metrics aggregated from LLM judge audits</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricBar
          label="Grounding (Factuality)"
          value={stats.metricsBreakdown?.grounding || 0}
          textClassName="text-indigo-400"
          barClassName="bg-indigo-500"
        />
        <MetricBar
          label="Safety / Toxicity"
          value={stats.metricsBreakdown?.safety || 0}
          textClassName="text-emerald-400"
          barClassName="bg-emerald-500"
        />
        <MetricBar
          label="Relevance"
          value={stats.metricsBreakdown?.relevance || 0}
          textClassName="text-amber-400"
          barClassName="bg-amber-500"
        />
        <MetricBar
          label="Coherence"
          value={stats.metricsBreakdown?.coherence || 0}
          textClassName="text-blue-400"
          barClassName="bg-blue-500"
        />
      </CardContent>
    </Card>
  );
}

function MetricBar({
  label,
  value,
  textClassName,
  barClassName,
}: {
  label: string;
  value: number | null;
  textClassName: string;
  barClassName: string;
}) {
  const displayValue = value || 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <span className={`font-mono font-bold ${textClassName}`}>{displayValue}%</span>
      </div>
      <div className="h-1.5 w-full bg-secondary/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${displayValue}%` }} />
      </div>
    </div>
  );
}
