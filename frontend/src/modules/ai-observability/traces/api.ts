import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiTraceRow } from "../api/types";

export type { AiTraceRow };

export async function listTraces(params?: {
  status?: string;
  serviceName?: string;
  endpoint?: string;
  traceId?: string;
  sessionId?: string;
  endUserId?: string;
  environment?: string;
  tag?: string;
  name?: string;
  level?: string;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  minCost?: number;
  maxCost?: number;
  limit?: number;
  page?: number;
}): Promise<{ traces: AiTraceRow[]; total: number; page: number; limit: number }> {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) search.set(key, String(value));
  });
  const q = search.toString();
  return await fetchAiJson(q ? `${AI_OBSERVABILITY_BASE}/traces?${q}` : `${AI_OBSERVABILITY_BASE}/traces`);
}
