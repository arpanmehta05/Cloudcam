import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, Cpu, Wallet, Boxes } from "@/icons";
import { Metrics } from "../../hooks/useGeminiRecommendations";

interface MetricsSummaryProps {
    metrics: Metrics;
    totalSavings: number;
}

export function MetricsSummary({ metrics, totalSavings }: MetricsSummaryProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-100 dark:from-[#0B1E19] dark:to-[#07111F]">
                <div className="flex items-center justify-between">
                    <p className="text-xl font-semibold text-foreground">
                        ${totalSavings.toFixed(2)}
                    </p>
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Potential savings/mo</p>
            </Card>
            <Card className="p-4 bg-white dark:bg-[#07111F]">
                <div className="flex items-center justify-between">
                    <p className="text-xl font-semibold text-foreground">
                        {metrics.ec2_cpu?.avg?.toFixed(1) || "0"}%
                    </p>
                    <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Avg CPU (7d)</p>
            </Card>
            <Card className="p-4 bg-white dark:bg-[#07111F]">
                <div className="flex items-center justify-between">
                    <p className="text-xl font-semibold text-foreground">
                        ${metrics.billing?.mtd?.total?.toFixed(2) || "---"}
                    </p>
                    <Wallet className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">MTD spend</p>
            </Card>
            <Card className="p-4 bg-white dark:bg-[#07111F]">
                <div className="flex items-center justify-between">
                    <p className="text-xl font-semibold text-foreground">
                        {metrics.inventory?.counts?.total ?? "---"}
                    </p>
                    <Boxes className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Active resources</p>
            </Card>
        </div>
    );
}
