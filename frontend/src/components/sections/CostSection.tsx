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
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { TrendingUp, Zap } from "@/icons";

interface CostProps {
    data: {
        dailySpend: { date: string; amount: number }[];
        byService: { name: string; cost: number; color: string }[];
        topDrivers: {
            resource: string;
            service: string;
            cost: number;
            utilization: string;
            status: "idle" | "healthy" | "overprovisioned" | "underprovisioned";
        }[];
        quickWins: { action: string; savings: string }[];
        forecast: number;
        currentSpend: number;
    };
}

export function CostSection({ data }: CostProps) {
    const statusColors = {
        idle: "bg-red-50 text-red-600",
        healthy: "bg-emerald-50 text-emerald-600",
        overprovisioned: "bg-amber-50 text-amber-600",
        underprovisioned: "bg-blue-50 text-blue-600",
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">Cost & Efficiency</h2>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Forecast:</span>
                    <span className="font-medium text-foreground">${data.forecast}</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {/* Monthly Trend */}
                <Card className="p-3 bg-card border-border col-span-2">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-medium text-foreground">Monthly Spend</h3>
                        <span className="text-[10px] text-muted-foreground">Current month</span>
                    </div>
                    <div className="h-32 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.dailySpend}>
                                <defs>
                                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
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
                                    tickFormatter={(v) => `$${v}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid #e5e5e5",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                    }}
                                    formatter={(v) => `$${v}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    fill="url(#costGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* By Service */}
                <Card className="p-3 bg-card border-border">
                    <h3 className="text-xs font-medium text-foreground mb-3">By Service</h3>
                    <div className="h-24 flex items-center justify-center overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.byService}
                                    dataKey="cost"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={2}
                                >
                                    {data.byService.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid #e5e5e5",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                    }}
                                    formatter={(v) => `$${v}`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {data.byService.slice(0, 4).map((s) => (
                            <span
                                key={s.name}
                                className="text-[9px] flex items-center gap-1"
                            >
                                <span
                                    className="w-2 h-2 rounded-sm"
                                    style={{ backgroundColor: s.color }}
                                ></span>
                                {s.name}
                            </span>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Top Drivers Table */}
            <Card className="p-3 bg-card border-border">
                <h3 className="text-xs font-medium text-foreground mb-3">Top Cost Drivers</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-muted-foreground border-b border-border">
                                <th className="text-left py-2 font-medium">Resource</th>
                                <th className="text-left py-2 font-medium">Service</th>
                                <th className="text-right py-2 font-medium">Est. Cost</th>
                                <th className="text-right py-2 font-medium">Utilization</th>
                                <th className="text-right py-2 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.topDrivers.slice(0, 5).map((d, i) => (
                                <tr key={i} className="border-b border-border/50">
                                    <td className="py-2 font-mono text-foreground">
                                        {d.resource.length > 16
                                            ? d.resource.slice(0, 16) + "..."
                                            : d.resource}
                                    </td>
                                    <td className="py-2 text-muted-foreground">{d.service}</td>
                                    <td className="py-2 text-right font-medium text-foreground">
                                        ${d.cost}/mo
                                    </td>
                                    <td className="py-2 text-right text-muted-foreground">
                                        {d.utilization}
                                    </td>
                                    <td className="py-2 text-right">
                                        <Badge
                                            className={`text-[9px] px-1.5 py-0 ${statusColors[d.status]}`}
                                        >
                                            {d.status}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Quick Wins */}
            <div className="flex gap-2">
                {data.quickWins.map((win, i) => (
                    <Card
                        key={i}
                        className="flex-1 p-3 bg-emerald-50 border-emerald-100 flex items-center gap-2"
                    >
                        <Zap className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[11px] text-emerald-700">
                            {win.action} →{" "}
                            <span className="font-medium">Save {win.savings}</span>
                        </span>
                    </Card>
                ))}
            </div>
        </div>
    );
}
