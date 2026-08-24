import { useState, useEffect, useCallback, useRef } from "react";
import { cloudApi } from "../api/cloud.api";

export function useMetrics(provider: string, serviceId: string, range: string, region: string) {
  const [metrics, setMetrics] = useState<any>(null);
  const [s3Buckets, setS3Buckets] = useState<any[]>([]);
  const [s3Summary, setS3Summary] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const fetchMetrics = useCallback(
    async (options?: { forceRefresh?: boolean; background?: boolean }) => {
      const isBackground = options?.background === true;
      const currentVersion = ++requestVersionRef.current;

      if (!isBackground) setLoading(true);
      setError(null);

      try {
        const data = await cloudApi.getMetrics(provider, serviceId, range, region, options?.forceRefresh);
        if (currentVersion !== requestVersionRef.current) return;

        if (data.success) {
          setMetrics(data.metrics);
          if (data.buckets) setS3Buckets(data.buckets);
          if (data.summary) setS3Summary(data.summary);
          if (data.diagnostics) setDiagnostics(data.diagnostics);
          else setDiagnostics(null);
        } else {
          setError(data.error || "Failed to fetch metrics");
        }
      } catch (err: any) {
        if (currentVersion !== requestVersionRef.current) return;
        setError(err.message || "Failed to fetch metrics");
      } finally {
        if (currentVersion === requestVersionRef.current && !isBackground) {
          setLoading(false);
        }
      }
    },
    [provider, serviceId, range, region]
  );

  useEffect(() => {
    setMetrics(null);
    setS3Buckets([]);
    setS3Summary(null);
    setDiagnostics(null);
    fetchMetrics();
  }, [provider, serviceId, range, region, fetchMetrics]);

  return {
    metrics,
    s3Buckets,
    s3Summary,
    diagnostics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
