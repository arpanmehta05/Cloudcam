import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiTraceDetail } from "../api/types";

export type { AiTraceDetail, AiTraceSpan, TraceScoreRow } from "../api/types";

export async function getTrace(traceId: string): Promise<AiTraceDetail> {
  return await fetchAiJson<AiTraceDetail & { success: boolean }>(`${AI_OBSERVABILITY_BASE}/traces/${encodeURIComponent(traceId)}`);
}
