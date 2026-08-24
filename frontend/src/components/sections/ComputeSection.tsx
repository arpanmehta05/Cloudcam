"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    LineChart,
    Line,
} from "recharts";
import { CheckCircle, AlertCircle, XCircle, ArrowUpRight } from "@/icons";
import Link from "next/link";

interface ComputeProps {
    data: {
        ec2Instances: {
            id: string;
            cpuAvg: number;
            cpuP95: number;
            netIn: string;
            netOut: string;
            statusCheck: "pass" | "fail";
            health: "healthy" | "warning" | "idle";
        }[];
        cpuHeatmap: { instance: string; hours: number[] }[];
        lambda: {
            history: { time: string; invocations: number; errors: number; duration: number }[];
            errorRate: number;
            avgDuration: number;
            concurrent: number;
        };
        amplify?: {
            id: string;
            requests: number;
            errors: number;
            status: "healthy" | "warning";
        }[];
    };
}

export function ComputeSection({ data }: ComputeProps) {
    const healthConfig = {
        healthy: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50" },
        warning: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50" },
        idle: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
    };

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Compute & Serverless</h2>

            <div className="grid grid-cols-5 gap-3">
                {/* EC2 Section */}
                <div className="col-span-3 space-y-3">
                    {/* Heatmap */}
                    <Card className="p-3 bg-card border-border">
                        <h3 className="text-xs font-medium text-foreground mb-3">
                            EC2 CPU Heatmap (24h)
                        </h3>
                        <div className="space-y-1">
                            {data.cpuHeatmap.slice(0, 5).map((row) => (
                                <div key={row.instance} className="flex items-center gap-2">
                                    <span className="text-[9px] font-mono text-muted-foreground w-20 truncate">
                                        {row.instance}
                                    </span>
                                    <div className="flex gap-0.5 flex-1">
                                        {row.hours.map((val, i) => (
                                            <div
                                                key={i}
                                                className="h-4 flex-1 rounded-sm"
                                                style={{
                                                    backgroundColor:
                                                        val > 80
                                                            ? "#ef4444"
                                                            : val > 60
                                                                ? "#f59e0b"
                                                                : val > 30
                                                                    ? "#22c55e"
                                                                    : "#e5e5e5",
                                                }}
                                                title={`${val}%`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[9px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-secondary rounded-sm"></span>0-30%
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-emerald-500 rounded-sm"></span>30-60%
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-amber-500 rounded-sm"></span>60-80%
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-red-500 rounded-sm"></span>80%+
                            </span>
                        </div>
                    </Card>

                    {/* EC2 Table */}
                    <Card className="p-3 bg-card border-border">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-muted-foreground border-b border-border">
                                        <th className="text-left py-2 font-medium">Instance</th>
                                        <th className="text-right py-2 font-medium">CPU Avg</th>
                                        <th className="text-right py-2 font-medium">CPU p95</th>
                                        <th className="text-right py-2 font-medium">Net In</th>
                                        <th className="text-right py-2 font-medium">Net Out</th>
                                        <th className="text-center py-2 font-medium">Status</th>
                                        <th className="text-right py-2 font-medium">Health</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.ec2Instances.slice(0, 5).map((inst) => {
                                        const health = healthConfig[inst.health];
                                        const HealthIcon = health.icon;
                                        return (
                                            <tr key={inst.id} className="border-b border-border/50">
                                                <td className="py-2 font-mono text-foreground">
                                                    {inst.id.slice(0, 12)}...
                                                </td>
                                                <td className="py-2 text-right">{inst.cpuAvg}%</td>
                                                <td className="py-2 text-right">{inst.cpuP95}%</td>
                                                <td className="py-2 text-right">{inst.netIn}</td>
                                                <td className="py-2 text-right">{inst.netOut}</td>
                                                <td className="py-2 text-center">
                                                    {inst.statusCheck === "pass" ? (
                                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="py-2 text-right">
                                                    <Badge className={`text-[9px] px-1.5 py-0 ${health.bg} ${health.color}`}>
                                                        {inst.health}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Lambda Section */}
                <div className="col-span-2 space-y-3">
                    <Card className="p-3 bg-card border-border">
                        <h3 className="text-xs font-medium text-foreground mb-3">Lambda Overview</h3>
                        <div className="h-32 overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.lambda.history}>
                                    <XAxis
                                        dataKey="time"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fill: "#a3a3a3" }}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fill: "#a3a3a3" }}
                                        width={25}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fill: "#a3a3a3" }}
                                        width={25}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#fff",
                                            border: "1px solid #e5e5e5",
                                            borderRadius: "6px",
                                            fontSize: "11px",
                                        }}
                                    />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="invocations"
                                        stroke="#3b82f6"
                                        strokeWidth={1.5}
                                        dot={false}
                                    />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="errors"
                                        stroke="#ef4444"
                                        strokeWidth={1.5}
                                        dot={false}
                                    />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="duration"
                                        stroke="#f59e0b"
                                        strokeWidth={1.5}
                                        strokeDasharray="3 3"
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex gap-3 mt-2 text-[10px]">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-0.5 bg-blue-500"></span>Invocations
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-0.5 bg-red-500"></span>Errors
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-0.5 bg-amber-500"></span>Duration
                            </span>
                        </div>
                    </Card>

                    {/* Lambda Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <Card className="p-3 bg-card border-border text-center">
                            <p className="text-lg font-semibold text-foreground">
                                {data.lambda.errorRate}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">Error Rate</p>
                        </Card>
                        <Card className="p-3 bg-card border-border text-center">
                            <p className="text-lg font-semibold text-foreground">
                                {data.lambda.avgDuration}ms
                            </p>
                            <p className="text-[10px] text-muted-foreground">Avg Duration</p>
                        </Card>
                        <Card className="p-3 bg-card border-border text-center">
                            <p className="text-lg font-semibold text-foreground">
                                {data.lambda.concurrent}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Concurrent</p>
                        </Card>
                    </div>

                    {/* Amplify Section (New) */}
                    <Card className="p-3 bg-card border-border">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-medium text-foreground">Amplify Hosting</h3>
                            <Link href="/dashboards/amplify">
                                <ArrowUpRight className="w-3 h-3 text-muted-foreground hover:text-muted-foreground cursor-pointer" />
                            </Link>
                        </div>
                        {data.amplify && data.amplify.length > 0 ? (
                            <div className="space-y-2">
                                {data.amplify.map((app) => (
                                    <div key={app.id} className="flex items-center justify-between text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{app.id}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {app.requests} requests
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <span className={`block font-medium ${app.errors > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                                    {app.errors} err
                                                </span>
                                            </div>
                                            <Badge className={`text-[9px] px-1.5 py-0 ${app.status === "healthy" ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500"}`}>
                                                {app.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-xs text-muted-foreground italic">
                                No active Amplify apps detected in the last hour.
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}

