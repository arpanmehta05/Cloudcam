import { useState, useEffect, useCallback, useRef } from "react";
import { aiObservabilityApi, BudgetStatus } from "../api/ai-observability.api";

export function useBudget() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const fetchBudget = useCallback(async () => {
    const currentVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await aiObservabilityApi.getBudget();
      if (currentVersion !== requestVersionRef.current) return;
      setBudget(data);
    } catch (err: any) {
      if (currentVersion !== requestVersionRef.current) return;
      setError(err.message || "Failed to fetch budget");
    } finally {
      if (currentVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  return {
    budget,
    loading,
    error,
    refetch: fetchBudget,
  };
}
