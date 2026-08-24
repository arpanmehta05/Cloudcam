import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { AiErrorRow, BedrockCloudwatchErrorRow } from "../api/types";

export type { AiErrorRow, BedrockCloudwatchErrorRow };

export async function getErrors(params?: {
  limit?: number;
  range?: string;
  provider?: string;
  status?: "error" | "rate_limited" | "timeout";
  includeCloudwatch?: boolean;
  region?: string;
  modelId?: string;
}): Promise<{ errors: AiErrorRow[]; cloudwatchErrors: BedrockCloudwatchErrorRow[] }> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.range) search.set("range", params.range);
  if (params?.provider && params.provider !== "all") search.set("provider", params.provider);
  if (params?.status) search.set("status", params.status);
  if (typeof params?.includeCloudwatch === "boolean") search.set("includeCloudwatch", String(params.includeCloudwatch));
  if (params?.region) search.set("region", params.region);
  if (params?.modelId) search.set("modelId", params.modelId);
  const q = search.toString();
  const data = await fetchAiJson<{
    success: boolean;
    errors: AiErrorRow[];
    cloudwatchErrors?: BedrockCloudwatchErrorRow[];
  }>(q ? `${AI_OBSERVABILITY_BASE}/errors?${q}` : `${AI_OBSERVABILITY_BASE}/errors`);
  return { errors: data.errors || [], cloudwatchErrors: data.cloudwatchErrors || [] };
}
