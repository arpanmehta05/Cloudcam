import { normalizePlaygroundProvider } from "../services/playground/prompt-playground.service";

export function logPlaygroundError(
  requestId: string,
  body: any,
  error: any,
): void {
  console.error("runPlayground error:", {
    requestId,
    message: error?.message,
    code: error?.code,
    status: error?.response?.status,
    provider: body?.provider,
    model: body?.model,
    endpointHost: getEndpointHost(body?.endpoint),
  });
}

export function buildPlaygroundErrorResponse(
  requestId: string,
  body: any,
  error: any,
) {
  const isTimeout = error?.code === "ECONNABORTED";
  const isValidationError = error?.statusCode === 400;
  const isNvidiaRequest =
    normalizePlaygroundProvider(
      String(body?.provider || ""),
      String(body?.model || ""),
    ) === "nvidia";

  return {
    status: isValidationError ? 400 : isTimeout ? 504 : 502,
    body: {
      success: false,
      code: isValidationError ? "ERR_BAD_REQUEST" : "ERR_AI_UPSTREAM_FAILED",
      error: isTimeout
        ? isNvidiaRequest
          ? "NVIDIA did not send a completion within 2 minutes. The model is currently queued, overloaded, or unavailable; retry later or choose another NVIDIA model."
          : "The upstream model did not finish before the 2 minute timeout."
        : error?.message || "The AI provider request failed.",
      retryable: !isValidationError,
      requestId,
    },
  };
}

function getEndpointHost(endpoint: unknown): string | undefined {
  try {
    return endpoint ? new URL(String(endpoint)).hostname : undefined;
  } catch {
    return undefined;
  }
}
