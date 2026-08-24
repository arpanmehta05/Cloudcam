"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    DollarSign,
    Cpu,
    Server,
    AlertTriangle,
    Zap,
    Shield,
} from "@/icons";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
} from "recharts";

interface OverviewProps {
    metrics: {
        mtdSpend: number | null;
        avgCpu: number;
        cpuTrend: "up" | "down" | "stable";
        targetsUp: number;
        targetsTotal: number;
        lambdaErrors: number;
        apiLatency: number;
        wafBlocked: number;
        cpuHistory: { time: string; value: number }[];
        lambdaHistory: { time: string; invocations: number; errors: number }[];
        topDrivers: {
            resource: string;
            service: string;
            cost: number;
            utilization: string;
            status: "idle" | "healthy" | "overprovisioned" | "underprovisioned";
        }[];
        lambdaStats: {
            errorRate: number;
            avgDuration: number;
            concurrent: number;
            totalInvocations: number;
        };
    };
    isLoading: boolean;
}

export function OverviewSection({ metrics, isLoading }: OverviewProps) {
    const stats = [
        {
            label: "MTD Spend",
            value: metrics.mtdSpend !== null ? `$${metrics.mtdSpend}` : "N/A",
            icon: DollarSign,
            color: "blue",
            subtext: "USD",
        },
        {
            label: "Avg CPU",
            value: `${metrics.avgCpu}%`,
            icon: Cpu,
            color: metrics.avgCpu > 80 ? "red" : metrics.avgCpu > 60 ? "amber" : "emerald",
            trend: metrics.cpuTrend,
        },
        {
            label: "Systems",
            value: `${metrics.targetsUp}/${metrics.targetsTotal}`,
            icon: Server,
            color: metrics.targetsUp === metrics.targetsTotal ? "emerald" : "amber",
            subtext: "up",
        },
        {
            label: "Lambda Errors",
            value: metrics.lambdaErrors.toString(),
            icon: AlertTriangle,
            color: metrics.lambdaErrors > 0 ? "red" : "emerald",
            subtext: "last 1h",
        },
        {
            label: "API p95",
            value: `${metrics.apiLatency}ms`,
            icon: Zap,
            color: metrics.apiLatency > 500 ? "amber" : "emerald",
        },
        {
            label: "WAF Blocked",
            value: metrics.wafBlocked.toString(),
            icon: Shield,
            color: "blue",
            subtext: "last 1h",
        },
    ];

    const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
        blue: { bg: "bg-secondary", text: "text-foreground", icon: "text-muted-foreground" },
        emerald: { bg: "bg-secondary", text: "text-foreground", icon: "text-muted-foreground" },
        amber: { bg: "bg-secondary", text: "text-foreground", icon: "text-muted-foreground" },
        red: { bg: "bg-secondary", text: "text-foreground", icon: "text-muted-foreground" },
    };

    return (
        <section className="space-y-3">
            {/* KPI Cards */}
            <div className="grid grid-cols-6 gap-3">
                {stats.map((stat, i) => {
                    const colors = colorMap[stat.color] || colorMap.blue;
                    const Icon = stat.icon;
                    return (
                        <Card
                            key={stat.label}
                            className={`p-3 ${i === 0 ? colors.bg : "bg-card"} border-border`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}>
                                    {stat.label}
                                </span>
                                <Icon className={`w-3.5 h-3.5 ${i === 0 ? colors.icon : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className={`text-xl font-semibold ${i === 0 ? "text-foreground" : "text-foreground"}`}>
                                    {isLoading ? "—" : stat.value}
                                </span>
                                {stat.trend && (
                                    <span className={colors.icon}>
                                        {stat.trend === "up" ? (
                                            <TrendingUp className="w-3 h-3" />
                                        ) : stat.trend === "down" ? (
                                            <TrendingDown className="w-3 h-3" />
                                        ) : (
                                            <Minus className="w-3 h-3" />
                                        )}
                                    </span>
                                )}
                                {stat.subtext && (
                                    <span className="text-[10px] text-muted-foreground">{stat.subtext}</span>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Top Cost Drivers */}
                <Card className="p-3 bg-card border-border">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-foreground">Top Cost Drivers</h3>
                        <span className="text-[10px] text-muted-foreground">Current Month</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-muted-foreground border-b border-border">
                                    <th className="text-left py-2 font-medium">Resource</th>
                                    <th className="text-left py-2 font-medium">Service</th>
                                    <th className="text-right py-2 font-medium">Cost</th>
                                    <th className="text-right py-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.topDrivers?.slice(0, 5).map((driver, i) => (
                                    <tr key={i} className="border-b border-border/50 last:border-0">
                                        <td className="py-2.5 font-mono text-foreground">
                                            {driver.resource.length > 16
                                                ? driver.resource.slice(0, 16) + "..."
                                                : driver.resource}
                                        </td>
                                        <td className="py-2.5 text-muted-foreground">{driver.service}</td>
                                        <td className="py-2.5 text-right font-medium text-foreground">
                                            ${driver.cost}
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <Badge
                                                variant="secondary"
                                                className={`text-[9px] px-1.5 py-0 ${driver.status === "healthy" ? "bg-emerald-50 text-emerald-600" :
                                                    driver.status === "idle" ? "bg-red-50 text-red-600" :
                                                        "bg-amber-50 text-amber-600"
                                                    }`}
                                            >
                                                {driver.status}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Lambda Overview */}
                <Card className="p-3 bg-card border-border">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-foreground">Lambda Overview</h3>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 text-[10px] text-foreground bg-secondary px-2 py-1 rounded-full">
                                <Zap className="w-3 h-3 text-muted-foreground" />
                                {metrics.lambdaStats?.concurrent} concurrent
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-secondary rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground">Error Rate</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {metrics.lambdaStats?.errorRate}%
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    Avg: 0.5%
                                </span>
                            </div>
                        </div>

                        <div className="p-3 bg-secondary rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground">Avg Duration</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {metrics.lambdaStats?.avgDuration}ms
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    P95: {(metrics.lambdaStats?.avgDuration || 0) * 1.5}ms
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                            <span>Activity (24h)</span>
                            <span>{metrics.lambdaStats?.totalInvocations?.toLocaleString()} invocations</span>
                        </div>
                        <div className="h-24 overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics.lambdaHistory} barGap={1}>
                                    <Bar
                                        dataKey="invocations"
                                        fill="#2563eb"
                                        radius={[2, 2, 0, 0]}
                                        opacity={0.8}
                                    />
                                    <Bar
                                        dataKey="errors"
                                        fill="#93c5fd"
                                        radius={[2, 2, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </Card>
            </div>
        </section>
    );
}
