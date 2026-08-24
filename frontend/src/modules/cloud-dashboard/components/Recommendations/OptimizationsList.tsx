import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Optimization } from "../../hooks/useGeminiRecommendations";

interface OptimizationsListProps {
    optimizations: Optimization[];
}

export function OptimizationsList({ optimizations }: OptimizationsListProps) {
    if (!optimizations || optimizations.length === 0) return null;

    return (
        <div>
            <h2 className="text-sm font-medium text-foreground mb-3">
                Optimization Opportunities
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {optimizations.map((opt) => (
                    <Card key={opt.id} className="p-3 bg-white hover:bg-secondary/30 dark:bg-[#07111F] dark:hover:bg-[#0C1929] transition-colors">
                        <h3 className="text-sm font-medium text-foreground mb-1">
                            {opt.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {opt.description}
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {opt.priority} priority
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {opt.effort} effort
                            </Badge>
                            {opt.savings && (
                                <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-[#0B1E19] dark:text-emerald-400 dark:border-emerald-950"
                                >
                                    Save {opt.savings}
                                </Badge>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
