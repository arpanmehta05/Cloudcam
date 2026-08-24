import { useState, useEffect, useCallback, useRef } from "react";
import { aiObservabilityApi, type AiAlertRow, type Anomaly } from "../../api/ai-observability.api";

export function useOverviewAlerts() {
  const [alerts, setAlerts] = useState<AiAlertRow[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const fetchAlertsAndAnomalies = useCallback(async () => {
    const currentVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);

    try {
      const [nextAlerts, nextAnomalies] = await Promise.all([
        aiObservabilityApi.getAlerts().catch(() => []),
        aiObservabilityApi.getAnomalies().catch(() => []),
      ]);

      if (currentVersion !== requestVersionRef.current) return;

      setAlerts(nextAlerts);
      setAnomalies(nextAnomalies);
    } catch (err: any) {
      if (currentVersion !== requestVersionRef.current) return;
      setError(err.message || "Failed to fetch alerts and anomalies");
    } finally {
      if (currentVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleResolveAlert = useCallback(async (id: string, status: "acknowledged" | "resolved") => {
    try {
      const updatedAlert = await aiObservabilityApi.patchAlert(id, status);
      setAlerts((current) =>
        current.map((alert) => (alert._id === id ? updatedAlert : alert))
      );
      return true;
    } catch (err: any) {
      console.error("[useOverviewAlerts] Resolve alert error:", err);
      return false;
    }
  }, []);

  const handleEvaluateAlerts = useCallback(async () => {
    try {
      const result = await aiObservabilityApi.evaluateAlerts();
      setAlerts(result.alerts);
      return result;
    } catch (err: any) {
      console.error("[useOverviewAlerts] Evaluate alerts error:", err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAlertsAndAnomalies();
  }, [fetchAlertsAndAnomalies]);

  return {
    alerts,
    anomalies,
    loading,
    error,
    resolveAlert: handleResolveAlert,
    evaluateAlerts: handleEvaluateAlerts,
    refetch: fetchAlertsAndAnomalies,
  };
}
