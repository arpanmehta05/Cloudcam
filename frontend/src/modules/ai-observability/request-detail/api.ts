import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiRequestTrace } from "../api/types";

export type { AiRequestTrace };

export async function getRequest(id: string): Promise<AiRequestTrace> {
  const data = await fetchAiJson<{ success: boolean; trace: AiRequestTrace }>(`${AI_OBSERVABILITY_BASE}/request/${id}`);
  return data.trace;
}
