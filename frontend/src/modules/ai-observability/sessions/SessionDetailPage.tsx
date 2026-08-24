"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { money, ObservabilityPageShell } from "../shared/ObservabilityPageShell";
import { useSessionDetail } from "./hooks/useSessionDetail";

export default function SessionDetailPage() {
  const sessionId = String(useParams()?.sessionId || "");
  const { traces } = useSessionDetail(sessionId);

  return (
    <ObservabilityPageShell title="Session Replay" subtitle={sessionId}>
      <Card className="rounded-lg">
        <CardContent className="p-0">
          {traces.map((trace) => (
            <Link key={trace.traceId} href={`/ai-observability/traces/${encodeURIComponent(trace.traceId)}`} className="grid gap-3 border-b p-4 transition hover:bg-primary/5 md:grid-cols-[1fr_120px_120px_120px]">
              <div className="min-w-0">
                <p className="truncate font-semibold">{trace.name || trace.traceId}</p>
                <p className="text-xs text-muted-foreground">{new Date(trace.startedAt).toLocaleString()}</p>
              </div>
              <Badge variant={trace.status === "success" ? "default" : "destructive"}>{trace.status}</Badge>
              <span className="text-sm text-muted-foreground">{trace.durationMs}ms</span>
              <span className="text-sm font-medium">{money(trace.totalCost)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </ObservabilityPageShell>
  );
}
