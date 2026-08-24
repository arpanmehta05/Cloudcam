"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    CheckCircle,
    XCircle,
    AlertCircle,
    AlertTriangle,
    Info,
    ExternalLink,
} from "@/icons";

interface HealthAlertsProps {
    data: {
        targets: {
            name: string;
            status: "up" | "down";
            job: string;
        }[];
        alerts: {
            id: string;
            name: string;
            severity: "critical" | "warning" | "info";
            service: string;
            firingFor: string;
            dashboardLink: string;
        }[];
        totalUp: number;
        totalTargets: number;
    };
}

export function HealthAlertsSection({ data }: HealthAlertsProps) {
    const severityConfig = {
        critical: {
            color: "bg-red-50 text-red-700 border-red-100",
            icon: AlertCircle,
            iconColor: "text-red-500",
        },
        warning: {
            color: "bg-amber-50 text-amber-700 border-amber-100",
            icon: AlertTriangle,
            iconColor: "text-amber-500",
        },
        info: {
            color: "bg-blue-50 text-blue-700 border-blue-100",
            icon: Info,
            iconColor: "text-blue-500",
        },
    };

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">System Health & Alerts</h2>

            <div className="grid grid-cols-5 gap-3">
                {/* Target Status */}
                <Card className="col-span-2 p-4 bg-card border-border">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-medium text-foreground">Prometheus Targets</h3>
                        <Badge
                            variant="secondary"
                            className={`text-[10px] ${data.totalUp === data.totalTargets
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-amber-50 text-amber-600"
                                }`}
                        >
                            {data.totalUp}/{data.totalTargets} up
                        </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {data.targets.map((target) => (
                            <div
                                key={target.name}
                                className={`flex items-center gap-2 p-2 rounded-md ${target.status === "up" ? "bg-emerald-50" : "bg-red-50"
                                    }`}
                            >
                                {target.status === "up" ? (
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium text-foreground truncate">
                                        {target.name}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">{target.job}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Active Alerts */}
                <Card className="col-span-3 p-4 bg-card border-border">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-medium text-foreground">Active Alerts</h3>
                        <Badge variant="secondary" className="text-[10px] bg-secondary">
                            {data.alerts.length} active
                        </Badge>
                    </div>
                    <ScrollArea className="h-32">
                        <div className="space-y-1.5">
                            {data.alerts.length === 0 ? (
                                <div className="flex items-center gap-2 text-emerald-600 text-sm py-4">
                                    <CheckCircle className="w-4 h-4" />
                                    No active alerts
                                </div>
                            ) : (
                                data.alerts.map((alert) => {
                                    const config = severityConfig[alert.severity];
                                    const SeverityIcon = config.icon;
                                    return (
                                        <div
                                            key={alert.id}
                                            className={`flex items-center justify-between p-2 rounded-md border ${config.color}`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <SeverityIcon className={`w-3.5 h-3.5 flex-shrink-0 ${config.iconColor}`} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge className="text-[8px] px-1 py-0 bg-card/50">
                                                            {alert.service}
                                                        </Badge>
                                                        <span className="text-[11px] font-medium truncate">
                                                            {alert.name}
                                                        </span>
                                                    </div>
                                                    <span className="text-[9px] opacity-75">
                                                        Firing for {alert.firingFor}
                                                    </span>
                                                </div>
                                            </div>
                                            <a
                                                href={alert.dashboardLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-shrink-0 p-1 hover:bg-card/50 rounded"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
}
