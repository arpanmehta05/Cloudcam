import React from "react";
import { Badge } from "@/components/ui/badge";
import { BudgetStatus } from "../../api/ai-observability.api";

interface BudgetManagerProps {
  budget: BudgetStatus | null;
}

function formatCost(value: number) {
  if (value === 0) return "$0.00";
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function BudgetManager({ budget }: BudgetManagerProps) {
  if (!budget?.rule) return null;

  return (
    <div className="border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium">Monthly budget</p>
          <p className="text-[10px] text-muted-foreground">
            {formatCost(budget.currentMonthSpend)} of {formatCost(budget.rule.monthlyLimit)}
          </p>
        </div>
        <Badge variant={budget.isMonthlyExceeded ? "destructive" : "outline"}>
          {budget.monthlyUsagePercent.toFixed(1)}%
        </Badge>
      </div>
      <div className="mt-3 h-2 overflow-hidden bg-secondary">
        <div
          className={
            budget.monthlyUsagePercent > 90
              ? "h-full bg-red-500"
              : budget.monthlyUsagePercent > 70
                ? "h-full bg-amber-500"
                : "h-full bg-green-500"
          }
          style={{ width: `${Math.min(budget.monthlyUsagePercent, 100)}%` }}
        />
      </div>
    </div>
  );
}
export default BudgetManager;
