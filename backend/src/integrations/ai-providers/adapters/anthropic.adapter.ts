// ─── Anthropic Claude Provider Adapter ───
// Parses Anthropic Messages API responses into normalized form.

import {
  AiProviderAdapter,
  NormalizedAiResponse,
  buildErrorContext,
  generateRequestId,
} from "./types";
import type { AiRequestStatus } from "../../../models/ai-request-log.model";

export const anthropicAdapter: AiProviderAdapter = {
  parseSuccessResponse(
    response: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse {
    // Anthropic Messages API shape: response.usage.input_tokens, output_tokens
    const usage = response?.usage || {};
    const promptTokens = usage.input_tokens || 0;
    const completionTokens = usage.output_tokens || 0;

    return {
      provider: "anthropic",
      modelName: response?.model || requestMeta?.model || "unknown",
      requestId: this.extractRequestId(response),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      status: "success",
      metadata: {
        stopReason: response?.stop_reason,
        cacheCreationInputTokens: usage.cache_creation_input_tokens,
        cacheReadInputTokens: usage.cache_read_input_tokens,
        ...requestMeta,
      },
    };
  },

  parseErrorResponse(
    error: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse {
    return {
      provider: "anthropic",
      modelName: requestMeta?.model || "unknown",
      requestId: generateRequestId("anthropic"),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      status: this.classifyError(error),
      errorMessage: error?.message || error?.error?.message || String(error),
      metadata: {
        errorType: error?.error?.type || error?.type,
        statusCode: error?.status,
        errorContext: buildErrorContext(error),
        ...requestMeta,
      },
    };
  },

  extractRequestId(response: any): string {
    // Anthropic returns `id` like "msg_abc123"
    return response?.id || generateRequestId("anthropic");
  },

  classifyError(error: any): AiRequestStatus {
    const status = error?.status || 0;
    const message = String(
      error?.message || error?.error?.message || "",
    ).toLowerCase();

    if (
      status === 429 ||
      message.includes("rate limit") ||
      message.includes("overloaded")
    )
      return "rate_limited";
    if (
      status === 408 ||
      message.includes("timeout") ||
      message.includes("timed out")
    )
      return "timeout";
    return "error";
  },
};
