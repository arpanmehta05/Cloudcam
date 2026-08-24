"use client";

import { useCallback, useEffect, useState } from "react";
import { getModels, type ModelRow } from "../api";

export function useModelUsage(dateRange: string, provider: string) {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelRow[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setModels(await getModels(dateRange, provider));
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, provider]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, models, refresh };
}
