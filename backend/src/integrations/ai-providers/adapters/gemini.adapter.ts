// ─── Google Gemini Provider Adapter ───
// Parses Gemini GenerateContent API responses into normalized form.

import {
  AiProviderAdapter,
  NormalizedAiResponse,
  buildErrorContext,
  generateRequestId,
} from "./types";
import type { AiRequestStatus } from "../../../models/ai-request-log.model";

export const geminiAdapter: AiProviderAdapter = {
  parseSuccessResponse(
    response: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse {
    // Gemini SDK response shape: response.usageMetadata
    const usage = response?.usageMetadata || response?.usage || {};
    const promptTokens = usage.promptTokenCount || usage.promptTokens || 0;
    const completionTokens =
      usage.candidatesTokenCount || usage.completionTokens || 0;
    const totalTokens =
      usage.totalTokenCount ||
      usage.totalTokens ||
      promptTokens + completionTokens;

    return {
      provider: "gemini",
      modelName: response?.modelVersion || requestMeta?.model || "unknown",
      requestId: this.extractRequestId(response),
      promptTokens,
      completionTokens,
      totalTokens,
      status: "success",
      metadata: {
        finishReason: response?.candidates?.[0]?.finishReason,
        safetyRatings: response?.candidates?.[0]?.safetyRatings,
        ...requestMeta,
      },
    };
  },

  parseErrorResponse(
    error: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse {
    return {
      provider: "gemini",
      modelName: requestMeta?.model || "unknown",
      requestId: generateRequestId("gemini"),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      status: this.classifyError(error),
      errorMessage:
        error?.message || error?.errorDetails?.[0]?.reason || String(error),
      metadata: {
        errorCode: error?.code || error?.status,
        errorStatus: error?.status,
        errorContext: buildErrorContext(error),
        ...requestMeta,
      },
    };
  },

  extractRequestId(response: any): string {
    // Gemini doesn't return a request ID — generate one
    return generateRequestId("gemini");
  },

  classifyError(error: any): AiRequestStatus {
    const status = error?.status || error?.code || 0;
    const message = String(error?.message || "").toLowerCase();

    if (
      status === 429 ||
      message.includes("resource_exhausted") ||
      message.includes("rate limit")
    )
      return "rate_limited";
    if (
      status === 408 ||
      message.includes("deadline") ||
      message.includes("timeout")
    )
      return "timeout";
    return "error";
  },
};
