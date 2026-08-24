import React from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

interface CostTimelineProps {
  costChart: Array<{ label: string; cost: number }>;
}

function money(value: number | undefined | null) {
  const n = value || 0;
  if (n === 0) return "$0.00";
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function CostTimeline({ costChart }: CostTimelineProps) {
  return (
    <div className="h-72">
      {costChart.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={costChart}>
            <defs>
              <linearGradient id="costFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => money(Number(value || 0))} />
            <Area dataKey="cost" stroke="var(--chart-1)" fill="url(#costFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState text="No cost data yet. Ingest events or sync Bedrock metrics." />
      )}
    </div>
  );
}
