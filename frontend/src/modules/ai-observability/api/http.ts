import { authFetch } from "@/lib/auth-fetch";

export const AI_OBSERVABILITY_BASE = "/api/ai-observability";

export async function fetchAiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    throw new Error(`API error: ${res.statusText}`);
  }
  return (await res.json()) as T;
}