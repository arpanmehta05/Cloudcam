"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, DollarSign, Zap, BarChart3, TrendingUp } from "@/icons";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { StatCard } from "./StatCard";
import { formatNumber, tooltipFmt, tooltipFmtUsd } from "./shared";

interface OpenAiTabProps {
  openaiUsage: any;
  usageLoading: boolean;
  days: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  completionChartData: any[];
  costChartData: any[];
}

export function OpenAiTab({
  openaiUsage,
  usageLoading,
  days,
  totalCost,
  totalInputTokens,
  totalOutputTokens,
  totalRequests,
  completionChartData,
  costChartData,
}: OpenAiTabProps) {
  if (openaiUsage?.hasData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={DollarSign}
            label="Total Cost"
            value={`$${totalCost.toFixed(2)}`}
            sub={`Last ${days} days`}
          />
          <StatCard
            icon={Zap}
            label="Total Tokens"
            value={formatNumber(totalInputTokens + totalOutputTokens)}
            sub={`${formatNumber(totalInputTokens)} in / ${formatNumber(totalOutputTokens)} out`}
          />
          <StatCard
            icon={BarChart3}
            label="API Requests"
            value={formatNumber(totalRequests)}
            sub={`~${(totalRequests / days).toFixed(0)}/day`}
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Cost/Day"
            value={`$${(totalCost / Math.max(days, 1)).toFixed(2)}`}
            sub={`Projected: $${((totalCost / Math.max(days, 1)) * 30).toFixed(2)}/mo`}
          />
        </div>

        {completionChartData.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono uppercase tracking-wider">
                Token Usage Over Time
              </CardTitle>
              <CardDescription className="text-xs font-mono">
                Input and output tokens per day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={completionChartData}>
                  <defs>
                    <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={formatNumber} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
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
                  <Area type="monotone" dataKey="inputTokens" name="Input Tokens" stroke="hsl(var(--primary))" fill="url(#inputGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outputTokens" name="Output Tokens" stroke="#10b981" fill="url(#outputGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {costChartData.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider">Daily Cost</CardTitle>
                <CardDescription className="text-xs font-mono">USD per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={costChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${Number(v).toFixed(3)}`} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 0,
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                      formatter={tooltipFmtUsd}
                    />
                    <Bar dataKey="totalCost" name="Cost" fill="#00f0ff" radius={[2, 2, 0, 0]} minPointSize={3} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {completionChartData.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider">API Requests</CardTitle>
                <CardDescription className="text-xs font-mono">Requests per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={completionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
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
                    <Line type="monotone" dataKey="requests" name="Requests" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          {usageLoading ? (
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          ) : (
            <>
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm font-mono text-muted-foreground">
                {openaiUsage?.error ? `Error: ${openaiUsage.error}` : "Fetching usage data..."}
              </p>
              <p className="text-xs font-mono text-muted-foreground max-w-md">
                The OpenAI Usage API requires an <strong>Admin API key</strong> (not a project key).
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
