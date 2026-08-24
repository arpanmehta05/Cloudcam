import React from "react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

interface TokenChartProps {
  tokenChart: Array<{ label: string; input: number; output: number; total: number }>;
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

export function TokenChart({ tokenChart }: TokenChartProps) {
  return (
    <div className="h-72">
      {tokenChart.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tokenChart}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => compact(Number(value || 0))} />
            <Bar dataKey="input" stackId="tokens" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="output" stackId="tokens" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState text="No token data yet. Send usage events to /ai-observability/events." />
      )}
    </div>
  );
}
