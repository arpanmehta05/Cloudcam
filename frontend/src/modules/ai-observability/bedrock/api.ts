import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { BedrockConsoleMetrics, BedrockWindow } from "../api/types";

export type { BedrockConsoleMetrics, BedrockWindow };

export async function getBedrockConsoleMetrics(params?: {
  window?: BedrockWindow;
  region?: string;
  modelId?: string;
  limit?: number;
}): Promise<BedrockConsoleMetrics> {
  const search = new URLSearchParams();
  if (params?.window) search.set("window", params.window);
  if (params?.region) search.set("region", params.region);
  if (params?.modelId) search.set("modelId", params.modelId);
  if (params?.limit) search.set("limit", String(params.limit));
  const q = search.toString();
  const url = q ? `${AI_OBSERVABILITY_BASE}/bedrock/console?${q}` : `${AI_OBSERVABILITY_BASE}/bedrock/console`;
  const data = await fetchAiJson<{ success: boolean; metrics: BedrockConsoleMetrics }>(url);
  return data.metrics;
}

export async function syncBedrockMetrics(params?: {
  region?: string;
  daysBack?: number;
}): Promise<{ metricsWritten: number; costsWritten: number }> {
  const search = new URLSearchParams();
  if (params?.region) search.set("region", params.region);
  if (params?.daysBack) search.set("daysBack", String(params.daysBack));
  const q = search.toString();
  const url = q ? `${AI_OBSERVABILITY_BASE}/bedrock/sync?${q}` : `${AI_OBSERVABILITY_BASE}/bedrock/sync`;
  const data = await fetchAiJson<{
    success: boolean;
    result: { metricsWritten: number; costsWritten: number };
  }>(url, { method: "POST" });
  return data.result;
}
