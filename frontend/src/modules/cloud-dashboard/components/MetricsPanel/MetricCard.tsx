import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, Bell, Loader2 } from "@/icons";
import {
  formatMetricValue,
  getMetricColor,
  getChartType,
} from "../../components/MetricsPanel/ChartConfig";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface MetricCardProps {
  metricDef: {
    name: string;
    namespace: string;
    metricName: string;
    unit: string;
  };
  mStats: {
    current: number;
    avg: number;
    max: number;
    min: number;
  } | null;
  metricConfig: any;
  diagnostics?: {
    resourceCount: number;
  } | null;
  loading: boolean;
  range: string;
  onCreateAlarm: () => void;
}

export function MetricCard({
  metricDef,
  mStats,
  metricConfig,
  diagnostics,
  loading,
  range,
  onCreateAlarm,
}: MetricCardProps) {
  const color = getMetricColor(metricDef.name);
  const gradientId = `grad-${metricDef.name.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const renderChart = () => {
    if (!metricConfig || !metricConfig.data || metricConfig.data.length === 0) {
      return (
        <div className="h-[250px] flex flex-col items-center justify-center border rounded-lg bg-muted/20 text-muted-foreground">
          <p className="text-sm italic">
            No data available for {metricConfig?.displayName || metricDef.name}
          </p>
          {diagnostics && (
            <p className="text-xs mt-1.5 opacity-60">
              {diagnostics.resourceCount === 0
                ? "No resources found in inventory"
                : `${diagnostics.resourceCount} resource${diagnostics.resourceCount !== 1 ? "s" : ""} queried`}
            </p>
          )}
        </div>
      );
    }

    const chartType = getChartType(metricConfig.unit ?? "");
    const xAxisProps: any = {
      dataKey: "timestamp",
      axisLine: false,
      tickLine: false,
      tick: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
      tickFormatter: (val: string) => {
        const d = new Date(val);
        if (range === "7d" || range === "30d")
          return d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
        return d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      },
      minTickGap: 40,
    };

    const yAxisProps: any = {
      stroke: "hsl(var(--muted-foreground))",
      fontSize: 11,
      tickLine: false,
      axisLine: false,
      width: 58,
      tickFormatter: (v: number) => formatMetricValue(v, metricConfig.unit ?? ""),
    };

    const tooltipProps: any = {
      contentStyle: {
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
        borderRadius: "8px",
        fontSize: 12,
      },
      formatter: (v: number) => [
        formatMetricValue(v, metricConfig.unit ?? ""),
        metricConfig.displayName,
      ],
      labelFormatter: (label: string) => new Date(label).toLocaleString(),
    };

    const cartesian = (
      <CartesianGrid
        strokeDasharray="3 3"
        vertical={false}
        stroke="hsl(var(--muted-foreground))"
        opacity={0.08}
      />
    );

    return (
      <div className="h-[250px] w-full overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart
              data={metricConfig.data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              {cartesian}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              <Bar
                dataKey="value"
                fill={color}
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
              />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart
              data={metricConfig.data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              {cartesian}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : (
            <AreaChart
              data={metricConfig.data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {cartesian}
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={`url(#${gradientId})`}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden group hover:border-border transition-colors">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] leading-none">
            {metricDef.name.replace(/_/g, " ")}
          </CardTitle>
          <div className="flex items-center gap-3 overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0"
              title="Create Alarm for this metric"
              onClick={onCreateAlarm}
            >
              <Bell className="h-4 w-4" />
            </Button>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Activity className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="flex items-baseline gap-4 mt-5">
          <span className="text-4xl font-bold tracking-tight text-foreground">
            {mStats
              ? formatMetricValue(mStats.current, metricDef.unit)
              : "—"}
          </span>
          {mStats && mStats.current > mStats.avg && (
            <span className="text-xs font-bold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {(
                ((mStats.current - mStats.avg) /
                  (mStats.avg || 1)) *
                100
              ).toFixed(0)}
              %
            </span>
          )}
        </div>
        {mStats && (
          <div className="flex gap-5 text-xs text-muted-foreground font-bold uppercase tracking-wider mt-3 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary/40" />
              avg{" "}
              <span className="text-foreground/70">
                {formatMetricValue(mStats.avg, metricDef.unit)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-destructive/40" />
              max{" "}
              <span className="text-foreground/70">
                {formatMetricValue(mStats.max, metricDef.unit)}
              </span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="h-[260px] p-0 overflow-hidden relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/40 z-10">
            <Loader2 className="h-10 w-10 text-primary animate-spin opacity-40" />
          </div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  );
}
