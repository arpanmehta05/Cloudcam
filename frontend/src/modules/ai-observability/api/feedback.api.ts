import { authFetch } from "@/lib/auth-fetch";
import type { AnnotationMetadata, FeedbackSentiment, FeedbackTargetType, HumanFeedback } from "../types/feedback";

const BASE = "/api/ai-observability";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(url, options);
  return (await response.json()) as T;
}

export const feedbackApi = {
  submit: async (input: {
    targetType: FeedbackTargetType;
    targetId?: string;
    traceId?: string;
    spanId?: string;
    requestId?: string;
    scoreConfigId?: string;
    dataType?: "numeric" | "categorical" | "boolean" | "text";
    score?: number;
    stringValue?: string;
    boolValue?: boolean;
    source?: "api" | "annotation" | "user_feedback" | "evaluator";
    sessionId?: string;
    sentiment?: FeedbackSentiment;
    comment?: string;
    tags?: string[];
  }) =>
    fetchJson<{ success: boolean; feedback: HumanFeedback }>(`${BASE}/feedback`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  list: async (params?: {
    targetType?: FeedbackTargetType;
    traceId?: string;
    spanId?: string;
    requestId?: string;
    sentiment?: FeedbackSentiment;
    tag?: string;
    page?: number;
    limit?: number;
  }) => {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim()) search.set(key, String(value));
    });
    const q = search.toString();
    return fetchJson<{ success: boolean; feedback: HumanFeedback[]; total: number; page: number; limit: number }>(
      `${BASE}/feedback${q ? `?${q}` : ""}`,
    );
  },

  upsertAnnotation: async (input: Partial<AnnotationMetadata> & { targetType: "trace" | "span" | "request" }) =>
    fetchJson<{ success: boolean; annotation: AnnotationMetadata }>(`${BASE}/annotations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listAnnotations: async (params?: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim()) search.set(key, String(value));
    });
    const q = search.toString();
    return fetchJson<{ success: boolean; annotations: AnnotationMetadata[]; total: number; page: number; limit: number }>(
      `${BASE}/annotations${q ? `?${q}` : ""}`,
    );
  },
};
