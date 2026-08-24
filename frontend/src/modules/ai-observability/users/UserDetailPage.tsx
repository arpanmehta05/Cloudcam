"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { money, ObservabilityPageShell } from "../shared/ObservabilityPageShell";
import { useUserDetail } from "./hooks/useUserDetail";

export default function UserDetailPage() {
  const endUserId = String(useParams()?.endUserId || "");
  const { traces } = useUserDetail(endUserId);

  return (
    <ObservabilityPageShell title="End-User Timeline" subtitle={endUserId}>
      <Card className="rounded-lg">
        <CardContent className="p-0">
          {traces.map((trace) => (
            <Link key={trace.traceId} href={`/ai-observability/traces/${encodeURIComponent(trace.traceId)}`} className="grid gap-3 border-b p-4 transition hover:bg-primary/5 md:grid-cols-[1fr_120px_120px_120px]">
              <div className="min-w-0">
                <p className="truncate font-semibold">{trace.name || trace.traceId}</p>
                <p className="text-xs text-muted-foreground">{trace.sessionId || "No session"}</p>
              </div>
              <Badge variant={trace.status === "success" ? "default" : "destructive"}>{trace.status}</Badge>
              <span className="text-sm text-muted-foreground">{trace.totalTokens.toLocaleString()} tokens</span>
              <span className="text-sm font-medium">{money(trace.totalCost)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </ObservabilityPageShell>
  );
}
