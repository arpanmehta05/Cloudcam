import { useCallback, useEffect, useState } from "react";
import { settingsApi } from "../api/settings.api";
import { KeyStatuses, OpenAIBucket } from "../types";

export function useAiKeysSettings() {
  const [keyStatus, setKeyStatus] = useState<KeyStatuses>({
    openai: { connected: false, connectedAt: null },
    anthropic: { connected: false, connectedAt: null },
    gemini: { connected: false, connectedAt: null },
    nvidia: { connected: false, connectedAt: null },
  });
  const [openaiUsage, setOpenaiUsage] = useState<any>(null);
  const [anthropicInfo, setAnthropicInfo] = useState<any>(null);
  const [geminiInfo, setGeminiInfo] = useState<any>(null);
  const [openaiLogs, setOpenaiLogs] = useState<any>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsDays, setLogsDays] = useState(3);
  const [perKeyData, setPerKeyData] = useState<any>(null);
  const [perKeyLoading, setPerKeyLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [days, setDays] = useState(30);

  const fetchStatus = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      try {
        const data = await settingsApi.getAiKeysStatus(options);
        if (data.success) setKeyStatus(data.keys);
      } catch {}
      setLoading(false);
    },
    [],
  );

  const fetchUsage = useCallback(
    async (options?: { background?: boolean; forceRefresh?: boolean }) => {
      if (!options?.background) setUsageLoading(true);
      try {
        const [oaiRes, antRes, gemRes] = await Promise.all([
          keyStatus.openai.connected
            ? settingsApi.getAiKeysUsage("openai", days, options).catch((e: any) => ({ success: false, error: e.message }))
            : null,
          keyStatus.anthropic.connected
            ? settingsApi.getAiKeysUsage("anthropic", days, options).catch((e: any) => ({ success: false, error: e.message }))
            : null,
          keyStatus.gemini.connected
            ? settingsApi.getAiKeysUsage("gemini", days, options).catch((e: any) => ({ success: false, error: e.message }))
            : null,
        ]);
        if (oaiRes) setOpenaiUsage(oaiRes);
        if (antRes?.success) setAnthropicInfo(antRes);
        if (gemRes?.success) setGeminiInfo(gemRes);
      } catch {}
      if (!options?.background) setUsageLoading(false);
    },
    [keyStatus, days],
  );

  const fetchLogs = useCallback(async () => {
    if (!keyStatus.openai.connected) return;
    setLogsLoading(true);
    try {
      const data = await settingsApi.getAiKeysLogs(logsDays);
      setOpenaiLogs(data);
    } catch (e: any) {
      setOpenaiLogs({ success: false, error: e.message });
    }
    setLogsLoading(false);
  }, [keyStatus.openai.connected, logsDays]);

  const fetchPerKey = useCallback(async () => {
    if (!keyStatus.openai.connected) return;
    setPerKeyLoading(true);
    try {
      const data = await settingsApi.getAiKeysPerKey(days);
      setPerKeyData(data);
    } catch (e: any) {
      setPerKeyData({ success: false, error: e.message });
    }
    setPerKeyLoading(false);
  }, [keyStatus.openai.connected, days]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (
      keyStatus.openai.connected ||
      keyStatus.anthropic.connected ||
      keyStatus.gemini.connected
    )
      fetchUsage();
  }, [keyStatus, fetchUsage]);

  const handleSaveKey = async (
    provider: "openai" | "anthropic" | "gemini" | "nvidia",
    apiKey: string,
  ) => {
    const data = await settingsApi.saveAiKey(provider, apiKey);
    if (!data.success) throw new Error(data.error);
    await fetchStatus();
  };

  const handleDeleteKey = async (
    provider: "openai" | "anthropic" | "gemini" | "nvidia",
  ) => {
    await settingsApi.deleteAiKey(provider);
    if (provider === "openai") setOpenaiUsage(null);
    if (provider === "anthropic") setAnthropicInfo(null);
    if (provider === "gemini") setGeminiInfo(null);
    await fetchStatus();
  };

  // Helper date formatter
  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Chart data calculations
  const completionChartData =
    openaiUsage?.completions?.data?.map((b: OpenAIBucket) => {
      const row: Record<string, any> = { date: formatDate(b.start_time) };
      let totalInput = 0,
        totalOutput = 0,
        totalRequests = 0;
      b.results.forEach((r) => {
        totalInput += r.input_tokens || 0;
        totalOutput += r.output_tokens || 0;
        totalRequests += r.num_model_requests || 0;
      });
      row.inputTokens = totalInput;
      row.outputTokens = totalOutput;
      row.totalTokens = totalInput + totalOutput;
      row.requests = totalRequests;
      return row;
    }) || [];

  const costChartData =
    openaiUsage?.costs?.data?.map((b: OpenAIBucket) => {
      const row: Record<string, any> = { date: formatDate(b.start_time) };
      let totalCost = 0;
      b.results.forEach((r) => {
        const val = r.amount?.value || 0;
        totalCost += val;
        if (r.line_item) row[r.line_item] = (row[r.line_item] || 0) + val;
      });
      row.totalCost = totalCost;
      return row;
    }) || [];

  const modelBreakdown: Record<string, { tokens: number; requests: number }> =
    {};
  openaiUsage?.completions?.data?.forEach((b: OpenAIBucket) => {
    b.results.forEach((r) => {
      const model = r.model || "unknown";
      if (!modelBreakdown[model])
        modelBreakdown[model] = { tokens: 0, requests: 0 };
      modelBreakdown[model].tokens +=
        (r.input_tokens || 0) + (r.output_tokens || 0);
      modelBreakdown[model].requests += r.num_model_requests || 0;
    });
  });

  const modelPieData = Object.entries(modelBreakdown)
    .filter(([, v]) => v.tokens > 0)
    .map(([name, v]) => ({
      name: name.replace("gpt-", "").replace("claude-", ""),
      tokens: v.tokens,
      requests: v.requests,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  const costLineItems: Record<string, number> = {};
  openaiUsage?.costs?.data?.forEach((b: OpenAIBucket) => {
    b.results.forEach((r) => {
      const item = r.line_item || "other";
      costLineItems[item] = (costLineItems[item] || 0) + (r.amount?.value || 0);
    });
  });

  const costPieData = Object.entries(costLineItems)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value: parseFloat(Number(value).toFixed(4)),
    }))
    .sort((a, b) => b.value - a.value);

  const totalInputTokens =
    Number(
      completionChartData.reduce(
        (s: number, r: any) => s + (Number(r.inputTokens) || 0),
        0,
      ),
    ) || 0;

  const totalOutputTokens =
    Number(
      completionChartData.reduce(
        (s: number, r: any) => s + (Number(r.outputTokens) || 0),
        0,
      ),
    ) || 0;

  const totalRequests =
    Number(
      completionChartData.reduce(
        (s: number, r: any) => s + (Number(r.requests) || 0),
        0,
      ),
    ) || 0;

  const totalCost =
    Number(
      costChartData.reduce(
        (s: number, r: any) => s + (Number(r.totalCost) || 0),
        0,
      ),
    ) || 0;

  return {
    keyStatus,
    openaiUsage,
    anthropicInfo,
    geminiInfo,
    openaiLogs,
    logsLoading,
    logsDays,
    perKeyData,
    perKeyLoading,
    loading,
    usageLoading,
    days,
    setDays,
    setLogsDays,
    fetchStatus,
    fetchUsage,
    fetchLogs,
    fetchPerKey,
    handleSaveKey,
    handleDeleteKey,
    completionChartData,
    costChartData,
    modelPieData,
    costPieData,
    totalInputTokens,
    totalOutputTokens,
    totalRequests,
    totalCost,
  };
}
