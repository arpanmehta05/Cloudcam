"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard, money, ObservabilityPageShell } from "../shared/ObservabilityPageShell";
import { useSessions } from "./hooks/useSessions";

export default function SessionsPage() {
  const { sessions } = useSessions();
  const totals = useMemo(() => sessions.reduce((acc, row) => ({
    traces: acc.traces + row.traceCount,
    tokens: acc.tokens + row.totalTokens,
    cost: acc.cost + row.totalCost,
  }), { traces: 0, tokens: 0, cost: 0 }), [sessions]);

  return (
    <ObservabilityPageShell title="Sessions" subtitle="Trace journeys grouped by application session.">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Sessions" value={String(sessions.length)} />
        <MetricCard label="Traces" value={totals.traces.toLocaleString()} />
        <MetricCard label="Cost" value={money(totals.cost)} />
      </div>
      <Card className="rounded-lg">
        <CardContent className="p-0">
          {sessions.map((session) => (
            <Link key={session.sessionId} href={`/ai-observability/sessions/${encodeURIComponent(session.sessionId)}`} className="grid gap-3 border-b p-4 transition hover:bg-primary/5 md:grid-cols-[1fr_120px_120px_120px]">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold">{session.sessionId}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(session.lastSeenAt).toLocaleString()}</p>
              </div>
              <Badge variant="outline">{session.traceCount} traces</Badge>
              <span className="text-sm text-muted-foreground">{session.totalTokens.toLocaleString()} tokens</span>
              <span className="text-sm font-medium">{money(session.totalCost)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </ObservabilityPageShell>
  );
}
