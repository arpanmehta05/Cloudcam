import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { ModelRow } from "../api/types";

export type { ModelRow };

export async function getModels(range?: string, provider?: string): Promise<ModelRow[]> {
  const search = new URLSearchParams();
  if (range) search.set("range", range);
  if (provider && provider !== "all") search.set("provider", provider);
  const q = search.toString();
  const data = await fetchAiJson<{ success: boolean; models: ModelRow[] }>(
    q ? `${AI_OBSERVABILITY_BASE}/models?${q}` : `${AI_OBSERVABILITY_BASE}/models`,
  );
  return data.models;
}
