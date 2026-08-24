import { useState, useEffect, useCallback, useRef } from "react";
import { cloudApi } from "../api/cloud.api";

function getRangeSeconds(range: string): number {
  switch (range) {
    case "1h":
      return 3600;
    case "6h":
      return 21600;
    case "24h":
      return 86400;
    case "7d":
      return 604800;
    default:
      return 86400;
  }
}

export function useLogs(
  provider: string,
  serviceId: string,
  range: string,
  region: string,
  hasLogGroup: boolean
) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLogs, setHasLogs] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string>("");
  const requestVersionRef = useRef(0);

  const fetchLogs = useCallback(
    async (resourceId?: string, options?: { forceRefresh?: boolean; background?: boolean }) => {
      if (!hasLogGroup) return;
      const isBackground = options?.background === true;
      const currentVersion = ++requestVersionRef.current;

      if (!isBackground) setLoading(true);

      try {
        const rangeSeconds = getRangeSeconds(range);
        const data = await cloudApi.getLogs(
          provider,
          serviceId,
          rangeSeconds,
          region,
          resourceId,
          options?.forceRefresh
        );
        if (currentVersion !== requestVersionRef.current) return;

        if (data.success) {
          setLogs(data.logs || []);
          setHasLogs(data.hasLogs ?? false);
        }
      } catch (err) {
        console.error("[useLogs] Fetch error:", err);
      } finally {
        if (currentVersion === requestVersionRef.current && !isBackground) {
          setLoading(false);
        }
      }
    },
    [provider, serviceId, range, region, hasLogGroup]
  );

  useEffect(() => {
    setLogs([]);
    setHasLogs(false);
    setSelectedResource("");
    fetchLogs("");
  }, [provider, serviceId, range, region, fetchLogs]);

  return {
    logs,
    loading,
    hasLogs,
    selectedResource,
    setSelectedResource,
    refetch: fetchLogs,
  };
}
