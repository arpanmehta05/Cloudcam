import React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type AiTraceRow } from "../../api/ai-observability.api";

interface TraceViewerProps {
  latestTraces: AiTraceRow[];
}

function money(value: number | undefined | null) {
  const n = value || 0;
  if (n === 0) return "$0.00";
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function compact(value: number | undefined | null) {
  const n = value || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function TraceViewer({ latestTraces }: TraceViewerProps) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Latest Traces</CardTitle>
          <CardDescription>Recent SDK traces linked into request analytics.</CardDescription>
        </div>
        <Link href="/ai-observability/traces">
          <Button size="sm" variant="outline">
            Open Explorer
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {latestTraces.length ? (
          <div className="grid gap-2">
            {latestTraces.map((trace) => (
              <Link
                key={trace.traceId}
                href={`/ai-observability/traces/${encodeURIComponent(trace.traceId)}`}
                className="flex flex-col gap-2 rounded-md border p-3 hover:bg-secondary/30 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{trace.name || trace.traceId}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{trace.traceId}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant={
                      trace.status === "error"
                        ? "destructive"
                        : trace.status === "partial"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {trace.status}
                  </Badge>
                  <span>{trace.durationMs || 0}ms</span>
                  <span>{compact(trace.totalTokens || 0)} tokens</span>
                  <span>{money(trace.totalCost || 0)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState text="No SDK traces yet. Create an ingest key from AI Observability Setup." />
        )}
      </CardContent>
    </Card>
  );
}
