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
import { GEMINI_PRICING, tooltipFmtMtok } from "./shared";
import { KeyStatus } from "../../types";

interface GeminiTabProps {
  geminiInfo: any;
  keyStatus: { gemini: KeyStatus };
}

export function GeminiTab({ geminiInfo, keyStatus }: GeminiTabProps) {
  if (!geminiInfo) {
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
        <StatCard icon={CheckCircle2} label="Key Status" value={geminiInfo.keyValid ? "Valid" : "Invalid"} />
        <StatCard icon={Brain} label="Available Models" value={String(geminiInfo.models?.length || 0)} />
        <StatCard icon={Clock} label="Connected" value={keyStatus.gemini.connectedAt ? new Date(keyStatus.gemini.connectedAt).toLocaleDateString() : "—"} />
      </div>

      {geminiInfo.models?.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider">Available Gemini Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {geminiInfo.models.map((m: string) => (
                <Badge key={m} variant="outline" className="font-mono text-[10px]">{m}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono uppercase tracking-wider">Gemini Model Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={Object.entries(GEMINI_PRICING).map(([model, p]) => ({
                model: model.replace("gemini-", ""),
                input: p.input,
                output: p.output,
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
              <YAxis dataKey="model" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={150} />
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
              <Bar dataKey="input" name="Input $/MTok" fill="#f59e0b" radius={[0, 2, 2, 0]} />
              <Bar dataKey="output" name="Output $/MTok" fill="#06b6d4" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
