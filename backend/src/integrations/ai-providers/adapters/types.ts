// ─── AI Provider Adapter: Common Interface ───
// All provider adapters implement this interface.

import type {
  AiProvider,
  AiRequestStatus,
} from "../../../models/ai-request-log.model";

/**
 * Normalized result from parsing any AI provider response.
 * This is the common shape before writing to AiRequestLog.
 */
export interface NormalizedAiResponse {
  provider: AiProvider;
  modelName: string;
  requestId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  status: AiRequestStatus;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Every provider adapter must implement these methods.
 */
export interface AiProviderAdapter {
  /** Parse a successful provider API response into normalized form. */
  parseSuccessResponse(
    response: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse;

  /** Parse a failed provider API error into normalized form. */
  parseErrorResponse(
    error: any,
    requestMeta?: Record<string, any>,
  ): NormalizedAiResponse;

  /** Extract a request ID from a provider response (or generate one). */
  extractRequestId(response: any): string;

  /** Map a provider error to our status enum. */
  classifyError(error: any): AiRequestStatus;
}

/** Generate a fallback request ID when provider doesn't return one. */
export function generateRequestId(provider: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${provider}_${ts}_${rand}`;
}

function safeString(
  value: unknown,
  maxLength: number = 800,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

/**
 * Keep provider error diagnostics useful without storing giant response bodies.
 * This is shown in the AI Observability error trace as "logs/context".
 */
export function buildErrorContext(error: any): Record<string, any> {
  const stack =
    typeof error?.stack === "string"
      ? error.stack.split("\n").slice(0, 8)
      : undefined;

  return {
    name: error?.name || error?.__type || error?.type,
    code: error?.code || error?.error?.code,
    type: error?.type || error?.error?.type,
    statusCode:
      error?.status || error?.statusCode || error?.$metadata?.httpStatusCode,
    requestId:
      error?.request_id || error?.requestId || error?.$metadata?.requestId,
    retryAttempts: error?.$metadata?.attempts,
    providerMessage: error?.message || error?.error?.message,
    responseBody: safeString(
      error?.response?.data || error?.body || error?.error,
    ),
    stack,
  };
}
