import { useState, useEffect, useCallback, useRef } from "react";
import { cloudApi } from "../api/cloud.api";

export function useBilling(provider: string, range: string) {
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const fetchBilling = useCallback(
    async (options?: { forceRefresh?: boolean; background?: boolean }) => {
      const isBackground = options?.background === true;
      const currentVersion = ++requestVersionRef.current;

      if (!isBackground) setLoading(true);
      setError(null);

      try {
        const data = await cloudApi.getBilling(provider, range, options?.forceRefresh);
        if (currentVersion !== requestVersionRef.current) return;

        if (data.success) {
          setBilling(data);
        } else {
          setError(data.error || "Failed to fetch billing data");
        }
      } catch (err: any) {
        if (currentVersion !== requestVersionRef.current) return;
        setError(err.message || "Failed to fetch billing data");
      } finally {
        if (currentVersion === requestVersionRef.current && !isBackground) {
          setLoading(false);
        }
      }
    },
    [provider, range]
  );

  useEffect(() => {
    setBilling(null);
    fetchBilling();
  }, [provider, range, fetchBilling]);

  return {
    billing,
    loading,
    error,
    refetch: fetchBilling,
  };
}
