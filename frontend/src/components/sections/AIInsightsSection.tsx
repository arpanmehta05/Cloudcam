"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ExternalLink,
    FileText,
    Wrench,
    ChevronRight,
    AlertCircle,
    AlertTriangle,
    Info,
} from "@/icons";

interface Insight {
    id: string;
    service: string;
    resource: string;
    region: string;
    severity: "critical" | "warning" | "info";
    title: string;
    rootCause: string;
    recommendations: { text: string; savings?: string }[];
}

interface InsightsProps {
    insights: Insight[];
    onOpenGrafana: (insight: Insight) => void;
}

export function AIInsightsSection({ insights, onOpenGrafana }: InsightsProps) {
    const severityConfig = {
        critical: {
            bg: "bg-card",
            border: "border-border",
            badge: "bg-foreground text-background",
            icon: AlertCircle,
            iconColor: "text-foreground",
        },
        warning: {
            bg: "bg-card",
            border: "border-border",
            badge: "bg-secondary text-foreground",
            icon: AlertTriangle,
            iconColor: "text-muted-foreground",
        },
        info: {
            bg: "bg-card",
            border: "border-border",
            badge: "bg-secondary text-muted-foreground",
            icon: Info,
            iconColor: "text-muted-foreground",
        },
    };

    return (
        <div className="h-full">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-foreground">AI Insights</h2>
                <Badge variant="secondary" className="text-[10px]">
                    {insights.length} active
                </Badge>
            </div>

            <ScrollArea className="h-[380px] pr-2">
                <div className="space-y-2">
                    {insights.map((insight, i) => {
                            const config = severityConfig[insight.severity];
                            const SeverityIcon = config.icon;

                            return (
                                <div key={insight.id}>
                                    <Card
                                        className={`p-3 ${config.bg} ${config.border} border`}
                                    >
                                        {/* Header */}
                                        <div className="flex items-start gap-2 mb-2">
                                            <SeverityIcon className={`w-4 h-4 mt-0.5 ${config.iconColor}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <Badge className={`text-[9px] px-1.5 py-0 ${config.badge}`}>
                                                        {insight.severity.toUpperCase()}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {insight.service} / {insight.resource}
                                                    </span>
                                                </div>
                                                <h3 className="text-sm font-medium text-foreground leading-tight">
                                                    {insight.title}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Root Cause */}
                                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                            {insight.rootCause}
                                        </p>

                                        {/* Recommendations */}
                                        <ul className="space-y-1 mb-3">
                                            {insight.recommendations.slice(0, 3).map((rec, j) => (
                                                <li
                                                    key={j}
                                                    className="flex items-start gap-1.5 text-[11px]"
                                                >
                                                    <ChevronRight className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                    <span className="text-foreground">
                                                        {rec.text}
                                                        {rec.savings && (
                                                            <span className="text-foreground font-medium ml-1">
                                                                → Save {rec.savings}
                                                            </span>
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* Actions */}
                                        <div className="flex gap-1.5">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-2"
                                                onClick={() => onOpenGrafana(insight)}
                                            >
                                                <ExternalLink className="w-2.5 h-2.5 mr-1" />
                                                Grafana
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-2"
                                            >
                                                <FileText className="w-2.5 h-2.5 mr-1" />
                                                Logs
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] px-2"
                                            >
                                                <Wrench className="w-2.5 h-2.5 mr-1" />
                                                Apply Fix
                                            </Button>
                                        </div>
                                    </Card>
                                </div>
                            );
                        })}

                    {insights.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No active insights
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
