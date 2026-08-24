import { useCallback, useEffect, useState } from "react";
import {
  getErrors,
  type AiErrorRow,
  type BedrockCloudwatchErrorRow,
} from "../api";

export function useErrors(dateRange: string, provider: string, status: string) {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<AiErrorRow[]>([]);
  const [cloudwatchErrors, setCloudwatchErrors] = useState<BedrockCloudwatchErrorRow[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getErrors({
        limit: 200,
        range: dateRange,
        provider: provider !== "all" ? provider : undefined,
        status: status !== "all" ? status as "error" | "rate_limited" | "timeout" : undefined,
        includeCloudwatch: true,
      });
      setErrors(data.errors);
      setCloudwatchErrors(data.cloudwatchErrors);
    } catch (error) {
      console.error("Failed to fetch errors:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, provider, status]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { loading, errors, cloudwatchErrors };
}
