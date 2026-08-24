import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiIngestKey } from "../api/types";

export type { AiIngestKey };

export async function listIngestKeys(): Promise<AiIngestKey[]> {
  const data = await fetchAiJson<{ success: boolean; keys: AiIngestKey[] }>(`${AI_OBSERVABILITY_BASE}/ingest-keys`);
  return data.keys || [];
}

export async function createIngestKey(input: { name: string; scopes?: string[] }): Promise<AiIngestKey> {
  const data = await fetchAiJson<{ success: boolean; key: AiIngestKey }>(`${AI_OBSERVABILITY_BASE}/ingest-keys`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.key;
}

export async function revokeIngestKey(id: string): Promise<void> {
  await fetchAiJson<{ success: boolean }>(`${AI_OBSERVABILITY_BASE}/ingest-keys/${id}`, { method: "DELETE" });
}

export const setupApi = {
  listIngestKeys,
  createIngestKey,
  revokeIngestKey,
};
