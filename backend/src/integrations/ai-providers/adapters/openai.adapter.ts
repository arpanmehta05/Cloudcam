// ─── OpenAI Provider Adapter ───
// Parses OpenAI Chat Completions API responses into normalized form.

import {
  AiProviderAdapter,
  NormalizedAiResponse,
  buildErrorContext,
  generateRequestId,
} from "./types";
import type { AiRequestStatus } from "../../../models/ai-request-log.model";

export const openaiAdapter: AiProviderAdapter = {
  parseSuccessResponse(
    response: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse {
    const usage = response?.usage || {};
    return {
      provider: "openai",
      modelName: response?.model || requestMeta?.model || "unknown",
      requestId: this.extractRequestId(response),
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens:
        usage.total_tokens ||
        (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
      status: "success",
      metadata: {
        systemFingerprint: response?.system_fingerprint,
        finishReason: response?.choices?.[0]?.finish_reason,
        ...requestMeta,
      },
    };
  },

  parseErrorResponse(
    error: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse {
    return {
      provider: "openai",
      modelName: requestMeta?.model || "unknown",
      requestId: generateRequestId("openai"),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      status: this.classifyError(error),
      errorMessage: error?.message || error?.error?.message || String(error),
      metadata: {
        errorType: error?.type || error?.error?.type,
        errorCode: error?.code || error?.error?.code,
        statusCode: error?.status || error?.statusCode,
        errorContext: buildErrorContext(error),
        ...requestMeta,
      },
    };
  },

  extractRequestId(response: any): string {
    // OpenAI returns `id` like "chatcmpl-abc123"
    return response?.id || generateRequestId("openai");
  },

  classifyError(error: any): AiRequestStatus {
    const status = error?.status || error?.statusCode || 0;
    const message = String(
      error?.message || error?.error?.message || "",
    ).toLowerCase();

    if (status === 429 || message.includes("rate limit")) return "rate_limited";
    if (
      status === 408 ||
      message.includes("timeout") ||
      message.includes("timed out")
    )
      return "timeout";
    return "error";
  },
};
