import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { PromptInsight } from "../api/types";

export type { PromptInsight };

export async function getPromptInsights(): Promise<PromptInsight[]> {
  const data = await fetchAiJson<{ success: boolean; insights: PromptInsight[] }>(
    `${AI_OBSERVABILITY_BASE}/recommendations/prompts`,
  );
  return data.insights;
}
