"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard, money, ObservabilityPageShell } from "../shared/ObservabilityPageShell";
import { useUsers } from "./hooks/useUsers";

export default function UsersPage() {
  const { users } = useUsers();
  const totalCost = users.reduce((sum, row) => sum + row.totalCost, 0);

  return (
    <ObservabilityPageShell title="End Users" subtitle="Per-user quality, usage, spend, and session coverage.">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Users" value={String(users.length)} />
        <MetricCard label="Sessions" value={users.reduce((sum, row) => sum + row.sessionIds.length, 0).toLocaleString()} />
        <MetricCard label="Cost" value={money(totalCost)} />
      </div>
      <Card className="rounded-lg">
        <CardContent className="p-0">
          {users.map((user) => (
            <Link key={user.endUserId} href={`/ai-observability/users/${encodeURIComponent(user.endUserId)}`} className="grid gap-3 border-b p-4 transition hover:bg-primary/5 md:grid-cols-[1fr_120px_120px_120px]">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold">{user.endUserId}</p>
                <p className="mt-1 text-xs text-muted-foreground">Last seen {new Date(user.lastSeenAt).toLocaleString()}</p>
              </div>
              <Badge variant="outline">{user.traceCount} traces</Badge>
              <span className="text-sm text-muted-foreground">{user.sessionIds.length} sessions</span>
              <span className="text-sm font-medium">{money(user.totalCost)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </ObservabilityPageShell>
  );
}
