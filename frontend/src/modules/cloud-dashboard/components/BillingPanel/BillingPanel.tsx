import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Zap, CloudIcon, Server, Activity } from "@/icons";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  formatMoney,
  getCurrencySymbol,
  compileAllCloudsHistory,
  compileAllCloudsBreakdown,
} from "../MetricsPanel/ChartConfig";

interface BillingPanelProps {
  billing: any;
  loading: boolean;
  range: string;
  activeProvider: string;
  setActiveProvider: (provider: string) => void;
}

export function BillingPanel({
  billing,
  loading,
  range,
  activeProvider,
  setActiveProvider,
}: BillingPanelProps) {
  if (loading && !billing) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  if (!billing) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Segmented Control Switcher */}
      <div className="flex flex-wrap gap-2 mb-6 bg-slate-200/50 dark:bg-slate-900/50 border border-slate-200/30 dark:border-slate-800/30 backdrop-blur-md p-1.5 rounded-xl max-w-md w-full sm:w-auto">
        {["all", "aws", "azure", "gcp"].map((p) => (
          <button
            key={p}
            onClick={() => setActiveProvider(p)}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer",
              activeProvider === p
                ? "bg-[#1A56DB] text-white dark:bg-[#6BA3F8] dark:text-[#020617] shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-slate-200/20 dark:hover:bg-slate-800/20"
            )}
          >
            {p === "all" ? "All Clouds" : p.toUpperCase()}
          </button>
        ))}
      </div>

      {activeProvider === "all" ? (
        <>
          {/* Warnings */}
          {billing.warnings && billing.warnings.length > 0 && (
            <div className="space-y-2 mb-6">
              {billing.warnings.map((warning: string, i: number) => (
                <div
                  key={i}
                  className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-lg flex items-center gap-3"
                >
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm font-semibold">{warning}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Total MTD Spend */}
            <Card className="p-6 relative overflow-hidden bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300/50 dark:hover:border-slate-700/50 group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp className="w-20 h-20 text-primary" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] font-extrabold mb-1">
                  Total MTD Spend
                </p>
                <span className="p-2 bg-primary/10 rounded-lg text-primary">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {formatMoney(
                  (billing.data || []).reduce((sum: number, p: any) => {
                    const spend = p.mtdSpend || p.currentSpend || 0;
                    const rate =
                      p.unit === "INR" || p.unit === "₹" || p.unit === "Rs." ? 83 : 1;
                    return sum + spend / rate;
                  }, 0),
                  "USD"
                )}
              </p>
              <p className="text-[11px] text-primary font-bold mt-4 flex items-center gap-1.5 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5" />
                Across all connected clouds
              </p>
            </Card>

            {/* Card 2: Total Projected Spend */}
            <Card className="p-6 relative overflow-hidden bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300/50 dark:hover:border-slate-700/50 group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-20 h-20 text-amber-500" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] font-extrabold mb-1">
                  Total Projected Spend
                </p>
                <span className="p-2 bg-amber-500/10 rounded-lg text-amber-500 dark:text-amber-400">
                  <Zap className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {formatMoney(
                  (billing.data || []).reduce((sum: number, p: any) => {
                    const spend = p.projectedTotal || p.mtdSpend || p.currentSpend || 0;
                    const rate =
                      p.unit === "INR" || p.unit === "₹" || p.unit === "Rs." ? 83 : 1;
                    return sum + spend / rate;
                  }, 0),
                  "USD"
                )}
              </p>
              <p className="text-[11px] text-muted-foreground font-bold mt-4 uppercase tracking-wider">
                End of month estimate
              </p>
            </Card>

            {/* Card 3: Top Cloud Provider */}
            <Card className="p-6 relative overflow-hidden bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300/50 dark:hover:border-slate-700/50 group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <CloudIcon className="w-20 h-20 text-purple-500" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] font-extrabold mb-1">
                  Top Cloud Provider
                </p>
                <span className="p-2 bg-purple-500/10 rounded-lg text-purple-500 dark:text-purple-400">
                  <CloudIcon className="h-4 w-4" />
                </span>
              </div>
              {(() => {
                const sortedData = [...(billing.data || [])]
                  .map((p: any) => {
                    const spend = p.mtdSpend || p.currentSpend || 0;
                    const rate =
                      p.unit === "INR" || p.unit === "₹" || p.unit === "Rs." ? 83 : 1;
                    return {
                      ...p,
                      spendInUSD: spend / rate,
                      originalSpend: spend,
                    };
                  })
                  .sort((a, b) => b.spendInUSD - a.spendInUSD);
                const topProvider = sortedData[0];
                if (!topProvider)
                  return (
                    <p className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                      —
                    </p>
                  );
                return (
                  <>
                    <p className="mt-4 text-3xl font-extrabold tracking-tight text-foreground truncate uppercase">
                      {topProvider.provider}
                    </p>
                    <p className="text-[12px] font-mono text-purple-600 dark:text-purple-400 font-bold mt-4">
                      {formatMoney(topProvider.originalSpend, topProvider.unit)} MTD
                    </p>
                  </>
                );
              })()}
            </Card>
          </div>

          {/* Stacked Daily Cost Trend */}
          <Card className="rounded-xl overflow-hidden mt-8 bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-md hover:border-slate-300/40 dark:hover:border-slate-700/40">
            <CardHeader className="pb-4 border-b border-border/10 bg-transparent">
              <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase tracking-widest leading-none">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                Multi-Cloud Spend Trend ({range === "7d" ? "Last 7 Days" : "Last 30 Days"})
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] p-6 pr-8">
              {(() => {
                const chartData = compileAllCloudsHistory(billing.data);
                if (chartData.length === 0) {
                  return (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                      No history data available
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorAws" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF9900" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#FF9900" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="colorAzure" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0078D4" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0078D4" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="colorGcp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4285F4" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#4285F4" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                        opacity={0.15}
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "var(--muted-foreground)",
                          fontWeight: "bold",
                        }}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "var(--muted-foreground)",
                          fontWeight: "bold",
                        }}
                        tickFormatter={(val) => `${getCurrencySymbol("USD")}${val}`}
                        domain={[0, (dataMax) => (dataMax <= 0.01 ? 10 : "auto")]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          borderRadius: "12px",
                          boxShadow: "var(--tw-shadow)",
                        }}
                        labelStyle={{
                          color: "var(--foreground)",
                          fontWeight: "bold",
                        }}
                        formatter={(val: any, name: any) => [
                          formatMoney(Number(val), "USD"),
                          name.toUpperCase(),
                        ]}
                        labelFormatter={(label) =>
                          new Date(label).toLocaleDateString(undefined, { dateStyle: "long" })
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="aws"
                        stackId="1"
                        stroke="#FF9900"
                        fill="url(#colorAws)"
                        strokeWidth={2.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="azure"
                        stackId="1"
                        stroke="#0078D4"
                        fill="url(#colorAzure)"
                        strokeWidth={2.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="gcp"
                        stackId="1"
                        stroke="#4285F4"
                        fill="url(#colorGcp)"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          {/* Cost share by Cloud Provider */}
          <Card className="rounded-xl mt-8 bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-md hover:border-slate-300/40 dark:hover:border-slate-700/40">
            <CardHeader className="pb-4 border-b border-border/10 bg-transparent">
              <CardTitle className="text-sm font-bold uppercase tracking-widest leading-none">
                Cost share by Cloud Provider
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {(() => {
                const totalSpendUSD =
                  (billing.data || []).reduce((sum: number, p: any) => {
                    const unit = p.unit || "USD";
                    const rate =
                      unit === "INR" || unit === "₹" || unit === "Rs." ? 83 : 1;
                    const spend = p.mtdSpend || p.currentSpend || 0;
                    return sum + spend / rate;
                  }, 0) || 1;
                return (
                  <div className="space-y-6">
                    {(billing.data || []).map((provData: any, idx: number) => {
                      const spend = provData.mtdSpend || provData.currentSpend || 0;
                      const unit = provData.unit || "USD";
                      const rate =
                        unit === "INR" || unit === "₹" || unit === "Rs." ? 83 : 1;
                      const spendUSD = spend / rate;
                      const percent = (spendUSD / totalSpendUSD) * 100;
                      const provColor =
                        provData.provider === "aws"
                          ? "bg-gradient-to-r from-amber-500 to-orange-500"
                          : provData.provider === "azure"
                            ? "bg-gradient-to-r from-sky-500 to-blue-600"
                            : "bg-gradient-to-r from-indigo-500 to-blue-500";
                      return (
                        <div key={idx} className="flex items-center gap-4">
                          <span className="w-24 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {provData.provider}
                          </span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-950/60 rounded-full h-2.5 overflow-hidden border border-slate-200/50 dark:border-slate-800/50 shadow-inner relative">
                            <div
                              style={{ width: `${percent}%` }}
                              className={cn("h-full rounded-full", provColor)}
                            />
                          </div>
                          <span className="w-16 text-right font-mono font-bold text-xs">
                            {percent.toFixed(1)}%
                          </span>
                          <span className="w-24 text-right font-mono font-bold text-sm">
                            {formatMoney(spend, unit)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Combined Cost by Service */}
          <Card className="rounded-xl mt-8 bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-md hover:border-slate-300/40 dark:hover:border-slate-700/40">
            <CardHeader className="pb-4 border-b border-border/10 bg-transparent">
              <CardTitle className="text-sm font-bold uppercase tracking-widest leading-none">
                Top services across all clouds
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-5">
                {(() => {
                  const combinedBreakdown = compileAllCloudsBreakdown(billing.data);
                  if (combinedBreakdown.length === 0) {
                    return (
                      <div className="text-muted-foreground text-sm italic">
                        No service breakdown data available
                      </div>
                    );
                  }
                  const max = combinedBreakdown[0]?.amount || 1;
                  return combinedBreakdown
                    .filter((s) => s.amount > 0)
                    .map((s: any, i: number) => {
                      const barColor =
                        s.provider === "aws"
                          ? "bg-gradient-to-r from-amber-500 to-orange-500"
                          : s.provider === "azure"
                            ? "bg-gradient-to-r from-sky-500 to-blue-600"
                            : "bg-gradient-to-r from-indigo-500 to-blue-500";
                      return (
                        <div key={i} className="flex items-center gap-3 group">
                          <span className="w-64 truncate text-xs font-bold text-foreground/70 group-hover:text-foreground transition-colors uppercase tracking-tight">
                            {s.service}
                          </span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-950/60 rounded-full h-2.5 overflow-hidden border border-slate-200/50 dark:border-slate-800/50 shadow-inner relative">
                            <div
                              style={{ width: `${(s.amount / max) * 100}%` }}
                              className={cn("h-full rounded-full", barColor)}
                            />
                          </div>
                          <span className="w-24 text-right font-mono font-bold text-sm text-foreground">
                            {formatMoney(s.originalAmount, s.unit)}
                          </span>
                        </div>
                      );
                    });
                })()}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {(billing.warning || (billing.warnings && billing.warnings.length > 0)) && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-lg flex items-center gap-3 mb-6">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-semibold">
                {billing.warning || billing.warnings?.[0]}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: MTD Spend */}
            <Card className="p-6 relative overflow-hidden bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300/50 dark:hover:border-slate-700/50 group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp className="w-20 h-20 text-primary" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] font-extrabold mb-1">
                  MTD Spend
                </p>
                <span className="p-2 bg-primary/10 rounded-lg text-primary">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {formatMoney(
                  billing.summary?.mtdSpend || billing.summary?.currentSpend || 0,
                  billing.summary?.unit
                )}
              </p>
              <p className="text-[11px] text-primary font-bold mt-4 flex items-center gap-1.5 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5" />
                {billing.summary?.range !== "Month to Date"
                  ? `${billing.summary?.range || ""}: ${formatMoney(billing.summary?.currentSpend || 0, billing.summary?.currentSpendUnit || billing.summary?.unit)}`
                  : `Unit: ${billing.summary?.unit || ""}`}
              </p>
            </Card>

            {/* Card 2: Projected Total */}
            <Card className="p-6 relative overflow-hidden bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300/50 dark:hover:border-slate-700/50 group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-20 h-20 text-amber-500" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] font-extrabold mb-1">
                  Projected Total
                </p>
                <span className="p-2 bg-amber-500/10 rounded-lg text-amber-500 dark:text-amber-400">
                  <Zap className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {billing.summary?.projectedTotal
                  ? formatMoney(billing.summary.projectedTotal, billing.summary?.unit)
                  : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground font-bold mt-4 uppercase tracking-wider">
                End of month estimate
              </p>
            </Card>

            {/* Card 3: Top Service */}
            <Card className="p-6 relative overflow-hidden bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300/50 dark:hover:border-slate-700/50 group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Server className="w-20 h-20 text-purple-500" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] font-extrabold mb-1">
                  Top Service ({range})
                </p>
                <span className="p-2 bg-purple-500/10 rounded-lg text-purple-500 dark:text-purple-400">
                  <Server className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-3xl font-extrabold tracking-tight text-foreground truncate">
                {billing.mtdBreakdown?.[0]?.service?.split(" - ")[0] ?? "—"}
              </p>
              <p className="text-[12px] font-mono text-purple-600 dark:text-purple-400 font-bold mt-4">
                {formatMoney(billing.mtdBreakdown?.[0]?.amount || 0, billing.summary?.unit)} MTD
              </p>
            </Card>
          </div>

          <Card className="rounded-xl overflow-hidden mt-8 bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-md hover:border-slate-300/40 dark:hover:border-slate-700/40">
            <CardHeader className="pb-4 border-b border-border/10 bg-transparent">
              <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase tracking-widest leading-none">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                Spend Trend ({range === "7d" ? "Last 7 Days" : "Last 30 Days"})
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] p-6 pr-8">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={billing.history}>
                  <defs>
                    <linearGradient id="colorCostHistory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                    opacity={0.15}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                      fontWeight: "bold",
                    }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                      fontWeight: "bold",
                    }}
                    tickFormatter={(val) => `${getCurrencySymbol(billing.summary?.unit)}${val}`}
                    domain={[0, (dataMax) => (dataMax <= 0.01 ? 10 : "auto")]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "12px",
                      boxShadow: "var(--tw-shadow)",
                    }}
                    labelStyle={{
                      color: "var(--foreground)",
                      fontWeight: "bold",
                    }}
                    itemStyle={{ color: "var(--primary)" }}
                    formatter={(val: any) => [
                      formatMoney(Number(val), billing.summary?.unit),
                      "Spend",
                    ]}
                    labelFormatter={(label) =>
                      new Date(label).toLocaleDateString(undefined, { dateStyle: "long" })
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--primary)"
                    fillOpacity={1}
                    fill="url(#colorCostHistory)"
                    strokeWidth={2.5}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-xl mt-8 bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-md hover:border-slate-300/40 dark:hover:border-slate-700/40">
            <CardHeader className="pb-4 border-b border-border/10 bg-transparent">
              <CardTitle className="text-sm font-bold uppercase tracking-widest leading-none">
                Cost by Service (MTD)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-5">
                {billing.mtdBreakdown
                  ?.filter((s: any) => s.amount > 0)
                  .map((s: any, i: number) => {
                    const max = billing.mtdBreakdown[0]?.amount || 1;
                    return (
                      <div key={i} className="flex items-center gap-3 group">
                        <span className="w-56 truncate text-xs font-bold text-foreground/70 group-hover:text-foreground transition-colors uppercase tracking-tight">
                          {s.service}
                        </span>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-950/60 rounded-full h-2.5 overflow-hidden border border-slate-200/50 dark:border-slate-800/50 shadow-inner relative">
                          <div
                            style={{ width: `${(s.amount / max) * 100}%` }}
                            className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full"
                          />
                        </div>
                        <span className="w-24 text-right font-mono font-bold text-sm text-foreground">
                          {formatMoney(s.amount, billing.summary?.unit)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
