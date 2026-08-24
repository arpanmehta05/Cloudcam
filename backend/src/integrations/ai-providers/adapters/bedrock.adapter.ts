// ─── AWS Bedrock Provider Adapter ───
// Parses Bedrock InvokeModel / Converse API responses into normalized form.
// Bedrock wraps multiple model families (Claude, Titan, Llama, Mistral).

import {
  AiProviderAdapter,
  NormalizedAiResponse,
  buildErrorContext,
  generateRequestId,
} from "./types";
import type { AiRequestStatus } from "../../../models/ai-request-log.model";

export const bedrockAdapter: AiProviderAdapter = {
  parseSuccessResponse(
    response: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse {
    // Bedrock Converse API returns usage in response.usage
    // Bedrock InvokeModel wraps the underlying model's response
    const usage = response?.usage || response?.metrics || {};
    const promptTokens = usage.inputTokens || usage.input_tokens || 0;
    const completionTokens = usage.outputTokens || usage.output_tokens || 0;

    // The model ID in Bedrock is the full ARN or model identifier
    const modelId =
      requestMeta?.modelId ||
      response?.modelId ||
      requestMeta?.model ||
      "unknown";

    return {
      provider: "bedrock",
      modelName: modelId,
      requestId: this.extractRequestId(response),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      status: "success",
      metadata: {
        bedrockRequestId: response?.$metadata?.requestId,
        stopReason: response?.stopReason || response?.stop_reason,
        // Store the underlying model family for analytics
        modelFamily: extractModelFamily(modelId),
        latencyMs:
          response?.metrics?.latencyMs || response?.$metadata?.totalRetryDelay,
        ...requestMeta,
      },
    };
  },

  parseErrorResponse(
    error: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse {
    const modelId = requestMeta?.modelId || requestMeta?.model || "unknown";

    return {
      provider: "bedrock",
      modelName: modelId,
      requestId: generateRequestId("bedrock"),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      status: this.classifyError(error),
      errorMessage: error?.message || String(error),
      metadata: {
        bedrockRequestId: error?.$metadata?.requestId,
        errorName: error?.name || error?.__type,
        statusCode: error?.$metadata?.httpStatusCode,
        errorContext: buildErrorContext(error),
        modelFamily: extractModelFamily(modelId),
        ...requestMeta,
      },
    };
  },

  extractRequestId(response: any): string {
    // Bedrock returns request ID in $metadata
    return response?.$metadata?.requestId || generateRequestId("bedrock");
  },

  classifyError(error: any): AiRequestStatus {
    const name = error?.name || error?.__type || "";
    const status = error?.$metadata?.httpStatusCode || 0;
    const message = String(error?.message || "").toLowerCase();

    if (
      status === 429 ||
      name === "ThrottlingException" ||
      message.includes("throttl")
    )
      return "rate_limited";
    if (
      status === 408 ||
      name === "ModelTimeoutException" ||
      message.includes("timeout")
    )
      return "timeout";
    return "error";
  },
};

/**
 * Extract the model family from a Bedrock model ID.
 * "anthropic.claude-3-5-sonnet-20241022-v2:0" → "anthropic.claude"
 * "amazon.titan-text-express-v1" → "amazon.titan"
 * "meta.llama3-1-70b-instruct-v1:0" → "meta.llama"
 */
function extractModelFamily(modelId: string): string {
  const match = modelId.match(/^([a-z]+)\.([a-z]+)/i);
  return match ? `${match[1]}.${match[2]}` : modelId;
}
