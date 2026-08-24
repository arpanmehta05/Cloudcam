"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { Globe, Zap, Shield, AlertTriangle } from "@/icons";

interface NetworkSecurityProps {
    data: {
        cloudfront: {
            history: { time: string; requests: number; errorRate: number }[];
        };
        apiGateway: {
            history: { time: string; p50: number; p95: number; count: number }[];
            totalRequests: number;
        };
        waf: {
            allowed: number;
            blocked: number;
            blockRate: number;
        };
        securityInsights: string[];
    };
}

export function NetworkSecuritySection({ data }: NetworkSecurityProps) {
    const wafData = [
        { name: "Allowed", value: data.waf.allowed, color: "#22c55e" },
        { name: "Blocked", value: data.waf.blocked, color: "#ef4444" },
    ];

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Network & Security</h2>

            <div className="grid grid-cols-3 gap-3">
                {/* CloudFront */}
                <Card className="p-3 bg-card border-border">
                    <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <h3 className="text-xs font-medium text-foreground">CloudFront</h3>
                    </div>
                    <div className="h-28 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.cloudfront.history}>
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
                                    domain={[0, 5]}
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
                                    dataKey="requests"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    dot={false}
                                    name="Requests"
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="errorRate"
                                    stroke="#ef4444"
                                    strokeWidth={1.5}
                                    dot={false}
                                    name="Error %"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px]">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 bg-blue-500"></span>Requests
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 bg-red-500"></span>Error %
                        </span>
                    </div>
                </Card>

                {/* API Gateway */}
                <Card className="p-3 bg-card border-border">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <h3 className="text-xs font-medium text-foreground">API Gateway</h3>
                        </div>
                        <Badge variant="secondary" className="text-[9px] bg-secondary">
                            {data.apiGateway.totalRequests.toLocaleString()} req/h
                        </Badge>
                    </div>
                    <div className="h-28 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.apiGateway.history}>
                                <XAxis
                                    dataKey="time"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: "#a3a3a3" }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: "#a3a3a3" }}
                                    width={30}
                                    tickFormatter={(v) => `${v}ms`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid #e5e5e5",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                    }}
                                    formatter={(v) => `${v}ms`}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="p50"
                                    stroke="#22c55e"
                                    strokeWidth={1.5}
                                    dot={false}
                                    name="p50"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="p95"
                                    stroke="#f59e0b"
                                    strokeWidth={1.5}
                                    dot={false}
                                    name="p95"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px]">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 bg-emerald-500"></span>p50
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 bg-amber-500"></span>p95
                        </span>
                    </div>
                </Card>

                {/* WAF + Security Insights */}
                <div className="space-y-3">
                    <Card className="p-3 bg-card border-border">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <h3 className="text-xs font-medium text-foreground">WAF</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-20 h-20 overflow-hidden">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={wafData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={22}
                                            outerRadius={35}
                                        >
                                            {wafData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-semibold text-foreground">
                                    {data.waf.blockRate}%
                                </p>
                                <p className="text-[10px] text-muted-foreground">Blocked</p>
                            </div>
                        </div>
                    </Card>

                    {/* Security Insights */}
                    <Card className="p-3 bg-amber-50 border-amber-100">
                        <div className="flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-[10px] font-medium text-amber-700">
                                Security Insights
                            </span>
                        </div>
                        <ul className="space-y-1">
                            {data.securityInsights.slice(0, 2).map((insight, i) => (
                                <li key={i} className="text-[10px] text-amber-700">
                                    • {insight}
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
}
