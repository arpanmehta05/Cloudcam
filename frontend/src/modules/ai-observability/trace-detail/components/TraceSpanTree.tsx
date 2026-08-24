"use client";

import { Badge } from "@/components/ui/badge";
import { Bot, Code, Database, GitBranch, Network, Route, Zap } from "@/icons";
import type { AiTraceSpan } from "../api";

interface TraceSpanTreeProps {
  spans: AiTraceSpan[];
  selectedId?: string;
  onSelect: (span: AiTraceSpan) => void;
}

const iconByKind: Record<string, typeof Bot> = {
  llm: Bot,
  embedding: Database,
  retrieval: Database,
  tool: Code,
  agent: Network,
  chain: GitBranch,
  reranker: Route,
  event: Zap,
};

function statusVariant(status: string): "destructive" | "secondary" | "outline" | "default" {
  if (status === "error" || status === "timeout") return "destructive";
  if (status === "rate_limited") return "secondary";
  if (status === "success") return "default";
  return "outline";
}

function depthFor(span: AiTraceSpan, byId: Map<string, AiTraceSpan>) {
  let depth = 0;
  let cursor = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
  while (cursor && depth < 6) {
    depth += 1;
    cursor = cursor.parentSpanId ? byId.get(cursor.parentSpanId) : undefined;
  }
  return depth;
}

export function TraceSpanTree({ spans, selectedId, onSelect }: TraceSpanTreeProps) {
  const byId = new Map(spans.map((span) => [span.spanId, span]));

  if (!spans.length) {
    return <p className="p-3 text-xs text-muted-foreground">No span tree captured.</p>;
  }

  return (
    <div className="max-h-[620px] overflow-auto p-2">
      {spans.map((span) => {
        const Icon = iconByKind[span.kind] || Zap;
        const depth = depthFor(span, byId);
        const selected = selectedId === span.spanId;
        return (
          <button
            key={span.spanId}
            type="button"
            onClick={() => onSelect(span)}
            className={`mb-1 grid w-full grid-cols-[20px_1fr_auto] items-center gap-2 rounded-md border px-2 py-2 text-left transition ${
              selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-secondary/40"
            }`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            aria-current={selected}
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{span.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{span.kind} / {span.modelName || span.provider || "custom"}</p>
            </div>
            <Badge variant={statusVariant(span.status)} className="h-5 text-[10px]">{span.durationMs || 0}ms</Badge>
          </button>
        );
      })}
    </div>
  );
}
