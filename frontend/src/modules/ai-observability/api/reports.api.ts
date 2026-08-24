import { authFetch } from "@/lib/auth-fetch";

const BASE = "/api/ai-observability";

export type SharedReportType = "overview" | "cost" | "trace" | "evaluation" | "custom";

export interface SharedReport {
  _id: string;
  token: string;
  title: string;
  description?: string | null;
  reportType: SharedReportType;
  snapshot: Record<string, unknown>;
  expiresAt?: string | null;
  revoked: boolean;
  viewCount: number;
  createdAt: string;
}

export interface PublicReport {
  title: string;
  description?: string | null;
  reportType: SharedReportType;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(url, options);
  return (await response.json()) as T;
}

export const reportsApi = {
  list: () => fetchJson<{ success: boolean; reports: SharedReport[] }>(`${BASE}/reports`),

  create: (input: {
    title: string;
    description?: string;
    reportType?: SharedReportType;
    snapshot?: Record<string, unknown>;
    expiresInDays?: number;
  }) =>
    fetchJson<{ success: boolean; report: SharedReport }>(`${BASE}/reports`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  revoke: (id: string) =>
    fetchJson<{ success: boolean; report: SharedReport }>(`${BASE}/reports/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
    }),
};

/** Public, unauthenticated fetch of a shared report by token. */
export async function fetchPublicReport(token: string): Promise<PublicReport | null> {
  const response = await fetch(`${BASE}/public/reports/${encodeURIComponent(token)}`);
  if (!response.ok) return null;
  const body = (await response.json()) as { success: boolean; report: PublicReport };
  return body.report || null;
}
