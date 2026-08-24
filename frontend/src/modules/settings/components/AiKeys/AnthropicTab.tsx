"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Brain, Clock } from "@/icons";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { StatCard } from "./StatCard";
import { CLAUDE_PRICING, tooltipFmtMtok } from "./shared";
import { KeyStatus } from "../../types";

interface AnthropicTabProps {
  anthropicInfo: any;
  keyStatus: { anthropic: KeyStatus };
}

export function AnthropicTab({ anthropicInfo, keyStatus }: AnthropicTabProps) {
  if (!anthropicInfo) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={CheckCircle2} label="Key Status" value={anthropicInfo.keyValid ? "Valid" : "Invalid"} />
        <StatCard icon={Brain} label="Available Models" value={String(anthropicInfo.models?.length || 0)} />
        <StatCard icon={Clock} label="Connected" value={keyStatus.anthropic.connectedAt ? new Date(keyStatus.anthropic.connectedAt).toLocaleDateString() : "—"} />
      </div>

      {anthropicInfo.models?.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider">Available Claude Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {anthropicInfo.models.map((m: string) => (
                <Badge key={m} variant="outline" className="font-mono text-[10px]">{m}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase tracking-wider">Claude Model Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={Object.entries(CLAUDE_PRICING).map(([model, p]) => ({
                model: model.replace("claude-", ""),
                input: p.input,
                output: p.output,
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
              <YAxis dataKey="model" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={120} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 0,
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
                formatter={tooltipFmtMtok}
              />
              <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 11 }} />
              <Bar dataKey="input" name="Input $/MTok" fill="#06b6d4" radius={[0, 2, 2, 0]} />
              <Bar dataKey="output" name="Output $/MTok" fill="#10b981" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
