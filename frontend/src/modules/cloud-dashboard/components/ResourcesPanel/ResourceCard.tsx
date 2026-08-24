import React from "react";
import { AlertTriangle, Zap } from "@/icons";
import { cn } from "@/lib/utils";

interface ResourceCardProps {
  insight: any;
  idx: number;
}

export function ResourceCard({ insight, idx }: ResourceCardProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border relative overflow-hidden group transition-all duration-300",
        insight.source === "static"
          ? "bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40"
          : "bg-primary/5 border-primary/20 hover:border-primary/40"
      )}
    >
      <div className="flex gap-4">
        <div
          className={cn(
            "p-2.5 rounded-lg h-fit",
            insight.source === "static"
              ? "bg-yellow-500/10 text-yellow-600"
              : "bg-primary/10 text-primary"
          )}
        >
          {insight.source === "static" ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Zap className="h-5 w-5" />
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-foreground leading-tight">
            {insight.title}
          </p>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            {insight.description}
          </p>
          <div className="flex items-center gap-3 mt-4">
            {insight.savingsPercentage > 0 && (
              <span className="text-[11px] text-emerald-500 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md">
                POTENTIAL SAVINGS: {insight.savingsPercentage}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
