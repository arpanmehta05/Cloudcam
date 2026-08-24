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
import { Database, HardDrive, AlertTriangle, CheckCircle } from "@/icons";

interface DatabaseStorageProps {
    data: {
        rds: {
            history: { time: string; cpu: number; connections: number }[];
            instances: {
                id: string;
                status: "healthy" | "cpu_bound" | "connection_saturation" | "storage_low";
            }[];
        };
        s3: {
            history: { date: string; size: number }[];
            buckets: {
                name: string;
                size: string;
                objects: string;
                coldPercent: number;
                lifecycle: boolean;
            }[];
        };
    };
}

export function DatabaseStorageSection({ data }: DatabaseStorageProps) {
    const rdsStatusConfig: Record<string, { label: string; color: string }> = {
        healthy: { label: "Healthy", color: "bg-emerald-50 text-emerald-600" },
        cpu_bound: { label: "CPU Bound", color: "bg-red-50 text-red-600" },
        connection_saturation: { label: "High Connections", color: "bg-amber-50 text-amber-600" },
        storage_low: { label: "Low Storage", color: "bg-red-50 text-red-600" },
    };

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Databases & Storage</h2>

            <div className="grid grid-cols-2 gap-3">
                {/* RDS */}
                <Card className="p-3 bg-card border-border">
                    <div className="flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4 text-blue-500" />
                        <h3 className="text-xs font-medium text-foreground">RDS Performance</h3>
                    </div>
                    <div className="h-28 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.rds.history}>
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
                                    domain={[0, 100]}
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
                                    dataKey="cpu"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    dot={false}
                                    name="CPU %"
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="connections"
                                    stroke="#8b5cf6"
                                    strokeWidth={1.5}
                                    dot={false}
                                    name="Connections"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px]">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 bg-blue-500"></span>CPU %
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 bg-purple-500"></span>Connections
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {data.rds.instances.map((inst) => {
                            const config = rdsStatusConfig[inst.status];
                            return (
                                <Badge
                                    key={inst.id}
                                    className={`text-[9px] px-1.5 py-0.5 ${config.color}`}
                                >
                                    {inst.id}: {config.label}
                                </Badge>
                            );
                        })}
                    </div>
                </Card>

                {/* S3 */}
                <Card className="p-3 bg-card border-border">
                    <div className="flex items-center gap-2 mb-3">
                        <HardDrive className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-xs font-medium text-foreground">S3 Storage</h3>
                    </div>
                    <div className="h-28 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.s3.history}>
                                <defs>
                                    <linearGradient id="s3Grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: "#a3a3a3" }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: "#a3a3a3" }}
                                    width={30}
                                    tickFormatter={(v) => `${v}GB`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid #e5e5e5",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                    }}
                                    formatter={(v) => `${v} GB`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="size"
                                    stroke="#22c55e"
                                    strokeWidth={1.5}
                                    fill="url(#s3Grad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr className="text-muted-foreground border-b border-border">
                                    <th className="text-left py-1 font-medium">Bucket</th>
                                    <th className="text-right py-1 font-medium">Size</th>
                                    <th className="text-right py-1 font-medium">Cold %</th>
                                    <th className="text-right py-1 font-medium">Lifecycle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.s3.buckets.slice(0, 3).map((b) => (
                                    <tr key={b.name} className="border-b border-border/50">
                                        <td className="py-1 font-mono">{b.name}</td>
                                        <td className="py-1 text-right">{b.size}</td>
                                        <td className="py-1 text-right">{b.coldPercent}%</td>
                                        <td className="py-1 text-right">
                                            {b.lifecycle ? (
                                                <CheckCircle className="w-3 h-3 text-emerald-500 inline" />
                                            ) : (
                                                <AlertTriangle className="w-3 h-3 text-amber-500 inline" />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
