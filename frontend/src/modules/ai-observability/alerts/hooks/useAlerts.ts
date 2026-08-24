import { useCallback, useEffect, useState } from "react";
import { getAlerts, type AiAlertRow } from "../api";

export function useAlerts() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AiAlertRow[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { loading, alerts, setAlerts, refetch: fetchAll };
}
