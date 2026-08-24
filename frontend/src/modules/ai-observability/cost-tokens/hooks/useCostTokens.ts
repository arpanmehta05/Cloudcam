"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getBudget,
  getCosts,
  type BudgetStatus,
  type CostResult,
} from "../api";

export function useCostTokens(dateRange: string, provider: string) {
  const [loading, setLoading] = useState(true);
  const [costData, setCostData] = useState<CostResult | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [costs, nextBudget] = await Promise.all([
        getCosts(dateRange, provider).catch(() => null),
        getBudget().catch(() => null),
      ]);
      setCostData(costs);
      setBudget(nextBudget);
    } finally {
      setLoading(false);
    }
  }, [dateRange, provider]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, costData, budget, refresh };
}
