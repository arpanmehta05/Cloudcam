"use client";

import { Badge } from "@/components/ui/badge";
import type { AiTraceDetail } from "../api";
import { money } from "../../shared/ObservabilityPageShell";

function statusVariant(status: string): "destructive" | "secondary" | "outline" | "default" {
  if (status === "error" || status === "timeout") return "destructive";
  if (status === "partial" || status === "rate_limited") return "secondary";
  if (status === "success") return "default";
  return "outline";
}

function metric(label: string, value: string) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

/**
 * Trace-level headline. These are the aggregates for the whole trace and must
 * NEVER react to span selection — selecting an embedding span (0 tokens / $0)
 * used to make the header read 0, which users misread as the trace's totals.
 * Span-level numbers live in the clearly-labelled "Selected span" panels.
 */
export function TraceDetailSummaryBar({ detail }: { detail: AiTraceDetail }) {
  const { trace } = detail;
  const prompt = trace.promptName || trace.promptSlug || "n/a";
  // No single model on the trace; derive it from the generation/llm span.
  const model =
    detail.spans.find(
      (span) => (span.kind === "generation" || span.kind === "llm") && span.modelName,
    )?.modelName ||
    detail.requests[0]?.modelName ||
    "n/a";
  const spanCount = trace.spanCount ?? detail.spans.length;

  return (
    <div className="sticky top-0 z-20 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="grid gap-3 md:grid-cols-[minmax(180px,1.4fr)_repeat(7,minmax(88px,1fr))] md:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(trace.status)}>{trace.status}</Badge>
            <p className="truncate text-sm font-semibold">{trace.name || "Trace"}</p>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{trace.traceId}</p>
        </div>
        {metric("Cost", money(trace.totalCost ?? 0))}
        {metric("Latency", `${trace.durationMs ?? 0}ms`)}
        {metric("TTFT", "n/a")}
        {metric("Tokens", String(trace.totalTokens ?? 0))}
        {metric("Model", model)}
        {metric("Prompt", prompt)}
        {metric("Spans", String(spanCount))}
      </div>
    </div>
  );
}
