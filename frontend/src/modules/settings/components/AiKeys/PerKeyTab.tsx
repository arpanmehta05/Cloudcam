"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, RefreshCw, Key } from "@/icons";
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
import { KeyTable } from "./KeyTable";
import { formatNumber, tooltipFmt } from "./shared";

interface PerKeyTabProps {
  perKeyData: any;
  perKeyLoading: boolean;
  fetchPerKey: () => Promise<void>;
  days: number;
}

export function PerKeyTab({
  perKeyData,
  perKeyLoading,
  fetchPerKey,
  days,
}: PerKeyTabProps) {
  if (!perKeyData) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-8 text-center">
          <Button variant="outline" size="sm" onClick={fetchPerKey} disabled={perKeyLoading} className="font-mono text-xs">
            {perKeyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
            Load Per-Key Usage Breakdown
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (perKeyData.success === false) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-mono text-muted-foreground">{perKeyData.error || "Failed to load per-key data"}</p>
          <Button variant="outline" size="sm" onClick={fetchPerKey} disabled={perKeyLoading} className="font-mono text-xs mt-3">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-mono uppercase tracking-wider text-foreground font-bold">Per-Key & Per-Project Breakdown</h3>
          <p className="text-xs font-mono text-muted-foreground mt-1">Last {days} days — usage grouped by API key, user, and project</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchPerKey} disabled={perKeyLoading} className="h-7">
          <RefreshCw className={`w-3.5 h-3.5 ${perKeyLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {perKeyData.byApiKey?.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider">Usage by API Key</CardTitle>
            <CardDescription className="text-xs font-mono">{perKeyData.byApiKey.length} key(s) with activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResponsiveContainer width="100%" height={Math.max(200, perKeyData.byApiKey.length * 40)}>
              <BarChart
                data={perKeyData.byApiKey.map((k: any) => {
                  const label = k.apiKeyName || k.apiKeyId;
                  return {
                    name: label.length > 16 ? `${label.slice(0, 14)}…` : label,
                    input: k.totalInput,
                    output: k.totalOutput,
                    cached: k.totalCached,
                  };
                })}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={formatNumber} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={75} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 0,
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                  formatter={tooltipFmt}
                />
                <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 11 }} />
                <Bar dataKey="input" name="Input Tokens" fill="#06b6d4" stackId="a" />
                <Bar dataKey="output" name="Output Tokens" fill="#10b981" stackId="a" />
                <Bar dataKey="cached" name="Cached Tokens" fill="#8b5cf6" stackId="a" />
              </BarChart>
            </ResponsiveContainer>

            <KeyTable byApiKey={perKeyData.byApiKey} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
