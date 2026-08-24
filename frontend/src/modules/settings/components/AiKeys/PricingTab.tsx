"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { OPENAI_PRICING, CLAUDE_PRICING, tooltipFmtMtok } from "./shared";

export function PricingTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase tracking-wider">OpenAI Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={Object.entries(OPENAI_PRICING).map(([model, p]) => ({
                model,
                input: p.input,
                output: p.output,
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
              <YAxis dataKey="model" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={100} />
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

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase tracking-wider">Anthropic Pricing</CardTitle>
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
              <Bar dataKey="input" name="Input $/MTok" fill="#8b5cf6" radius={[0, 2, 2, 0]} />
              <Bar dataKey="output" name="Output $/MTok" fill="#ec4899" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
