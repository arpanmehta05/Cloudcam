import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiSavedView, AiSavedViewInput, AiSavedViewType } from "../api/types";

export type { AiSavedView, AiSavedViewInput, AiSavedViewType };

export async function listSavedViews(viewType?: AiSavedViewType): Promise<AiSavedView[]> {
  const q = viewType ? `?viewType=${encodeURIComponent(viewType)}` : "";
  const data = await fetchAiJson<{ success: boolean; views: AiSavedView[] }>(`${AI_OBSERVABILITY_BASE}/views${q}`);
  return data.views || [];
}

export async function createSavedView(input: AiSavedViewInput): Promise<AiSavedView> {
  const data = await fetchAiJson<{ success: boolean; view: AiSavedView }>(`${AI_OBSERVABILITY_BASE}/views`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.view;
}

export async function updateSavedView(id: string, input: AiSavedViewInput): Promise<AiSavedView> {
  const data = await fetchAiJson<{ success: boolean; view: AiSavedView }>(`${AI_OBSERVABILITY_BASE}/views/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.view;
}

export async function deleteSavedView(id: string): Promise<void> {
  await fetchAiJson<{ success: boolean }>(`${AI_OBSERVABILITY_BASE}/views/${encodeURIComponent(id)}`, { method: "DELETE" });
}
