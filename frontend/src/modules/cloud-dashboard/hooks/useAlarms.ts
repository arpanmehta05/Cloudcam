import { useState, useEffect, useCallback, useRef } from "react";
import { cloudApi } from "../api/cloud.api";

export function useAlarms(provider: string, region: string) {
  const [alarms, setAlarms] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingAlarms, setProcessingAlarms] = useState<Record<string, "deleting" | "toggling">>({});
  const requestVersionRef = useRef(0);

  const fetchAlarms = useCallback(
    async (options?: { forceRefresh?: boolean; background?: boolean }) => {
      const isBackground = options?.background === true;
      const currentVersion = ++requestVersionRef.current;

      if (!isBackground) setLoading(true);
      setError(null);

      try {
        const data = await cloudApi.getAlarms(provider, region, options?.forceRefresh);
        if (currentVersion !== requestVersionRef.current) return;

        if (data.success) {
          setAlarms(data);
        } else {
          setError(data.error || "Failed to fetch alarms");
        }
      } catch (err: any) {
        if (currentVersion !== requestVersionRef.current) return;
        setError(err.message || "Failed to fetch alarms");
      } finally {
        if (currentVersion === requestVersionRef.current && !isBackground) {
          setLoading(false);
        }
      }
    },
    [provider, region]
  );

  const handleToggleAlarm = useCallback(
    async (alarm: any, enabled: boolean) => {
      const key = `${alarm.name}_${alarm.region}`;
      setProcessingAlarms((prev) => ({ ...prev, [key]: "toggling" }));
      setError(null);

      try {
        const data = await cloudApi.toggleAlarm(provider, alarm.name, alarm.region, enabled);
        if (data.success) {
          setAlarms((current: any) => {
            if (!current?.alarms) return current;
            return {
              ...current,
              alarms: current.alarms.map((item: any) =>
                item.name === alarm.name && item.region === alarm.region
                  ? { ...item, actionsEnabled: enabled }
                  : item
              ),
            };
          });
        } else {
          setError(data.error || `Failed to toggle alarm actions for "${alarm.name}"`);
        }
      } catch (err: any) {
        setError(err.message || `Failed to toggle alarm actions for "${alarm.name}"`);
      } finally {
        setProcessingAlarms((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }
    },
    [provider]
  );

  const handleDeleteAlarm = useCallback(
    async (alarmName: string, alarmRegion: string) => {
      const key = `${alarmName}_${alarmRegion}`;
      setProcessingAlarms((prev) => ({ ...prev, [key]: "deleting" }));
      setError(null);

      try {
        const data = await cloudApi.deleteAlarm(provider, alarmName, alarmRegion);
        if (data.success) {
          setAlarms((current: any) => {
            if (!current?.alarms) return current;
            const updatedAlarms = current.alarms.filter(
              (item: any) => !(item.name === alarmName && item.region === alarmRegion)
            );
            const deletedAlarm = current.alarms.find(
              (item: any) => item.name === alarmName && item.region === alarmRegion
            );
            const deletedState = deletedAlarm?.state?.toUpperCase();

            return {
              ...current,
              alarms: updatedAlarms,
              counts: {
                ...current.counts,
                total: Math.max(0, (current.counts?.total || 1) - 1),
                alarm: deletedState === "ALARM" ? Math.max(0, (current.counts?.alarm || 1) - 1) : current.counts?.alarm,
                ok: deletedState === "OK" ? Math.max(0, (current.counts?.ok || 1) - 1) : current.counts?.ok,
                insufficient:
                  deletedState === "INSUFFICIENT_DATA"
                    ? Math.max(0, (current.counts?.insufficient || 1) - 1)
                    : current.counts?.insufficient,
              },
            };
          });
          return true;
        } else {
          setError(data.error || `Failed to delete alarm "${alarmName}"`);
          return false;
        }
      } catch (err: any) {
        setError(err.message || `Failed to delete alarm "${alarmName}"`);
        return false;
      } finally {
        setProcessingAlarms((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }
    },
    [provider]
  );

  useEffect(() => {
    setAlarms(null);
    fetchAlarms();
  }, [provider, region, fetchAlarms]);

  return {
    alarms,
    loading,
    error,
    processingAlarms,
    toggleAlarm: handleToggleAlarm,
    deleteAlarm: handleDeleteAlarm,
    refetch: fetchAlarms,
  };
}
