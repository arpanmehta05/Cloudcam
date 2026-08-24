import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiOverview } from "../api/types";

export type { AiOverview };

export async function getOverview(provider?: string, range?: string): Promise<AiOverview> {
  const search = new URLSearchParams();
  if (provider && provider !== "all") search.set("provider", provider);
  if (range) search.set("range", range);
  const q = search.toString();
  const data = await fetchAiJson<{ success: boolean; overview: AiOverview }>(
    q ? `${AI_OBSERVABILITY_BASE}/overview?${q}` : `${AI_OBSERVABILITY_BASE}/overview`,
  );
  return data.overview;
}
