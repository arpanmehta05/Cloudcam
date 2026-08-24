import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiSessionRow, AiTraceRow, AiTraceSpan } from "../api/types";

export type { AiSessionRow, AiTraceRow, AiTraceSpan };

export async function listSessions(): Promise<AiSessionRow[]> {
  const data = await fetchAiJson<{ success: boolean; sessions: AiSessionRow[] }>(`${AI_OBSERVABILITY_BASE}/sessions`);
  return data.sessions || [];
}

export async function getSession(sessionId: string): Promise<{ sessionId: string; traces: AiTraceRow[]; spans: AiTraceSpan[] }> {
  return await fetchAiJson(`${AI_OBSERVABILITY_BASE}/sessions/${encodeURIComponent(sessionId)}`);
}
