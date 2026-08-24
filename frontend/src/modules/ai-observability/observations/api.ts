import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiTraceSpan, ObservationQueryParams } from "../api/types";

export type { AiTraceSpan, ObservationFieldGroup, ObservationQueryParams } from "../api/types";

export async function listObservations(
  params?: ObservationQueryParams,
): Promise<{ observations: AiTraceSpan[]; nextCursor: string | null }> {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      search.set(key, value.join(","));
    } else if (value !== undefined && value !== null && String(value).trim()) {
      search.set(key, String(value));
    }
  });
  const q = search.toString();
  return await fetchAiJson(q ? `${AI_OBSERVABILITY_BASE}/observations?${q}` : `${AI_OBSERVABILITY_BASE}/observations`);
}
