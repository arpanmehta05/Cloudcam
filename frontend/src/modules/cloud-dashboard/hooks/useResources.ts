import { useState, useEffect, useCallback, useRef } from "react";
import { cloudApi } from "../api/cloud.api";

export function useResources(provider: string, region: string, serviceId: string) {
  const [inventory, setInventory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [insights, setInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const requestVersionRef = useRef(0);

  const fetchResourcesAndInsights = useCallback(
    async (options?: { forceRefresh?: boolean; background?: boolean }) => {
      const isBackground = options?.background === true;
      const currentVersion = ++requestVersionRef.current;

      if (!isBackground) {
        setLoading(true);
        setInsightsLoading(true);
      }
      setError(null);

      try {
        const [inventoryData, insightsData] = await Promise.all([
          cloudApi.getResources(provider, region, options?.forceRefresh),
          cloudApi.getInsights(provider, region, options?.forceRefresh),
        ]);

        if (currentVersion !== requestVersionRef.current) return;

        if (inventoryData.success) {
          setInventory(inventoryData.inventory);
        } else {
          setError(inventoryData.error || "Failed to fetch inventory resources");
        }

        if (insightsData.success) {
          const serviceInsights = (insightsData.recommendations || []).filter(
            (r: any) => r.type === serviceId
          );
          setInsights(serviceInsights);
        }
      } catch (err: any) {
        if (currentVersion !== requestVersionRef.current) return;
        setError(err.message || "Failed to fetch inventory and insights");
      } finally {
        if (currentVersion === requestVersionRef.current) {
          if (!isBackground) {
            setLoading(false);
            setInsightsLoading(false);
          }
        }
      }
    },
    [provider, region, serviceId]
  );

  useEffect(() => {
    setInventory(null);
    setInsights([]);
    fetchResourcesAndInsights();
  }, [provider, region, serviceId, fetchResourcesAndInsights]);

  return {
    inventory,
    insights,
    loading,
    insightsLoading,
    error,
    refetch: fetchResourcesAndInsights,
  };
}
