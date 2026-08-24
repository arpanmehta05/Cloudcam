import type { AiProvider } from "../../../../models/ai-request-log.model";
import {
    buildErrorContext,
    generateRequestId,
    type NormalizedAiResponse,
} from "../../../../integrations/ai-providers";

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function numeric(value: unknown): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function buildGenericSuccess(
    provider: AiProvider,
    model: string,
    response: unknown,
    metadata?: Record<string, unknown>,
): NormalizedAiResponse {
    const record = asRecord(response);
    const usage = asRecord(record.usage || record.usageMetadata);
    const promptTokens = numeric(usage.prompt_tokens || usage.promptTokenCount || usage.input_tokens);
    const completionTokens = numeric(usage.completion_tokens || usage.candidatesTokenCount || usage.output_tokens);
    return {
        provider,
        modelName: typeof record.model === "string" ? record.model : model,
        requestId: typeof record.id === "string" ? record.id : generateRequestId(provider),
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        status: "success",
        metadata: { ...metadata, adapterUsed: "generic" },
    };
}

export function buildGenericError(
    provider: AiProvider,
    model: string,
    error: unknown,
    metadata?: Record<string, unknown>,
): NormalizedAiResponse {
    const record = asRecord(error);
    const status = numeric(record.status || record.statusCode);
    const message = String(record.message || "").toLowerCase();
    const errorStatus = status === 429 || message.includes("rate limit")
        ? "rate_limited"
        : status === 408 || message.includes("timeout") ? "timeout" : "error";
    return {
        provider,
        modelName: model,
        requestId: generateRequestId(provider),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        status: errorStatus,
        errorMessage: String(record.message || error),
        metadata: { ...metadata, adapterUsed: "generic", errorContext: buildErrorContext(error) },
    };
}
