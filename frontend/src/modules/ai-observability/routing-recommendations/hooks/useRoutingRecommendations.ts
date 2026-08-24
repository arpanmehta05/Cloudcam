import { useCallback, useEffect, useState } from "react";
import {
  getRoutingRecommendations,
  type RoutingRecommendation,
} from "../api";

export function useRoutingRecommendations() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    recommendations: RoutingRecommendation[];
    totalMonthlySavings: number;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRoutingRecommendations();
      setData(result);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to fetch routing recommendations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, data, lastUpdated, refresh: fetchData };
}
