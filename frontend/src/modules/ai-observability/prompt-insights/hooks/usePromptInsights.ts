import { useCallback, useEffect, useState } from "react";
import { getPromptInsights, type PromptInsight } from "../api";

export function usePromptInsights() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<PromptInsight[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPromptInsights();
      setInsights(result);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to fetch prompt insights:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, insights, lastUpdated, refresh: fetchData };
}
