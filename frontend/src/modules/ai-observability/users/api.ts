import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiEndUserRow, AiTraceRow } from "../api/types";

export type { AiEndUserRow, AiTraceRow };

export async function listEndUsers(): Promise<AiEndUserRow[]> {
  const data = await fetchAiJson<{ success: boolean; users: AiEndUserRow[] }>(`${AI_OBSERVABILITY_BASE}/users`);
  return data.users || [];
}

export async function getEndUser(endUserId: string): Promise<{ endUserId: string; sessionIds: string[]; traces: AiTraceRow[] }> {
  return await fetchAiJson(`${AI_OBSERVABILITY_BASE}/users/${encodeURIComponent(endUserId)}`);
}
