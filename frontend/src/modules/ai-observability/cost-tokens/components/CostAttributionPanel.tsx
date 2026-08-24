"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCostAttribution,
  getEvaluationCost,
  type CostAttributionRow,
  type CostDimension,
  type EvaluationCostSummary,
} from "../api";

const DIMENSIONS: { key: CostDimension; label: string }[] = [
  { key: "prompt", label: "Prompt Version" },
  { key: "model", label: "Model" },
  { key: "user", label: "User" },
  { key: "session", label: "Session" },
  { key: "endpoint", label: "Endpoint" },
  { key: "service", label: "Service" },
];

function money(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value > 0) return `$${value.toFixed(4)}`;
  return "$0.00";
}

function labelFor(dimension: CostDimension, key: Record<string, string | null>): { text: string; href?: string } {
  switch (dimension) {
    case "prompt": {
      const slug = key.slug || "unknown";
      const version = key.version ? ` @ ${key.version}` : "";
      const q = `promptSlug:${slug}${key.version ? ` promptVersion:${key.version}` : ""}`;
      return { text: `${slug}${version}${key.label ? ` (${key.label})` : ""}`, href: `/ai-observability/traces?q=${encodeURIComponent(q)}` };
    }
    case "model":
      return { text: `${key.provider || "?"} / ${key.model || "unknown"}` };
    case "user":
      return { text: key.user || "anonymous", href: key.user ? `/ai-observability/users/${encodeURIComponent(key.user)}` : undefined };
    case "session":
      return { text: key.session || "none", href: key.session ? `/ai-observability/sessions/${encodeURIComponent(key.session)}` : undefined };
    case "endpoint":
      return { text: key.endpoint || "unknown" };
    case "service":
      return { text: key.service || "unknown" };
    default:
      return { text: JSON.stringify(key) };
  }
}

export function CostAttributionPanel() {
  const [dimension, setDimension] = useState<CostDimension>("prompt");
  const [rows, setRows] = useState<CostAttributionRow[]>([]);
  const [evalCost, setEvalCost] = useState<EvaluationCostSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (dim: CostDimension) => {
    setLoading(true);
    try {
      const [attribution, evaluation] = await Promise.all([
        getCostAttribution(dim, 30),
        getEvaluationCost(30),
      ]);
      setRows(attribution.rows);
      setEvalCost(evaluation);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(dimension);
  }, [dimension, load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm">Cost Attribution (30d)</CardTitle>
        <div className="flex flex-wrap gap-1">
          {DIMENSIONS.map((dim) => (
            <Button
              key={dim.key}
              size="sm"
              variant={dimension === dim.key ? "secondary" : "ghost"}
              className="h-7 px-2 text-[10px] font-mono"
              onClick={() => setDimension(dim.key)}
            >
              {dim.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {evalCost && (
          <div className="flex flex-wrap gap-2 border-b pb-3 text-[11px]">
            <Badge variant="outline" className="font-mono">Judge runs: {evalCost.judgeRuns} (~{money(evalCost.estimatedJudgeCost)})</Badge>
            <Badge variant="outline" className="font-mono">Experiment runs: {evalCost.experimentRuns} ({money(evalCost.experimentItemCost)})</Badge>
            <Badge variant="outline" className="border-amber-500/40 font-mono text-amber-400">Total eval cost: {money(evalCost.totalEvaluationCost)}</Badge>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No cost data for this dimension in the window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                  <th className="py-1.5 pr-2">{DIMENSIONS.find((d) => d.key === dimension)?.label}</th>
                  <th className="py-1.5 pr-2 text-right">Cost</th>
                  <th className="py-1.5 pr-2 text-right">Requests</th>
                  <th className="py-1.5 pr-2 text-right">Tokens</th>
                  <th className="py-1.5 pr-2 text-right">Errors</th>
                  <th className="py-1.5 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const label = labelFor(dimension, row.key);
                  return (
                    <tr key={index} className="border-b border-border/40">
                      <td className="py-1.5 pr-2 font-mono">
                        {label.href ? (
                          <Link href={label.href} className="text-blue-400 hover:underline">{label.text}</Link>
                        ) : (
                          label.text
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono font-semibold">{money(row.cost)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{row.requests.toLocaleString()}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{row.tokens.toLocaleString()}</td>
                      <td className={`py-1.5 pr-2 text-right font-mono ${row.errors > 0 ? "text-red-400" : ""}`}>{row.errors}</td>
                      <td className="py-1.5 text-right font-mono">{row.avgLatencyMs}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
