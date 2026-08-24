export type AiProvider = "openai" | "gemini" | "anthropic" | "bedrock" | "custom";
export type SpanKind = "chain" | "tool" | "llm" | "embedding" | "reranker" | "custom";
export type SpanStatus = "success" | "error" | "rate_limited" | "timeout";

export interface RabbittWatchAIOptions {
    apiKey: string;
    endpoint?: string;
    serviceName?: string;
    environment?: string;
    captureInput?: boolean;
    captureOutput?: boolean;
    previewMaxChars?: number;
    flushIntervalMs?: number;
    maxBatchSize?: number;
    debug?: boolean;
    retries?: number;
    /** Default TTL for the prompt resolve cache in ms. Defaults to 60000. */
    promptCacheTtlMs?: number;
    redactPatterns?: RegExp[];
    customRedactFn?: (text: string) => string;
}

export * from "./plugin.js";

export interface PromptContext {
    templateId?: string;
    versionId?: string;
    slug?: string;
    version?: string;
    label?: string;
    environment?: string;
    state?: "draft" | "production" | "archived";
    contentHash?: string;
    hash?: string;
    template?: string;
    systemPrompt?: string;
    variables?: string[];
    metadata?: Record<string, unknown>;
}

export interface PromptResolveOptions {
    version?: string;
    label?: string;
    environment?: string;
    state?: "draft" | "production" | "archived";
    /** Cache TTL for this resolve in ms. Defaults to client promptCacheTtlMs (60s). Set 0 to bypass. */
    cacheTtlMs?: number;
    /** Inline fallback used when the API is unavailable and no cached copy exists. */
    fallback?: Pick<PromptContext, "template" | "systemPrompt" | "variables" | "version">;
}

export interface TraceOptions {
    traceId?: string;
    name: string;
    endpoint?: string;
    serviceName?: string;
    environment?: string;
    sessionId?: string;
    endUserId?: string;
    release?: string;
    provider?: AiProvider;
    model?: string;
    input?: unknown;
    prompt?: PromptContext;
    metadata?: Record<string, unknown>;
    tags?: string[];
}

export interface SpanOptions {
    spanId?: string;
    parentSpanId?: string;
    name: string;
    kind?: SpanKind;
    provider?: AiProvider;
    model?: string;
    sessionId?: string;
    endUserId?: string;
    input?: unknown;
    prompt?: PromptContext;
    metadata?: Record<string, unknown>;
}

export interface SpanEndOptions {
    status?: SpanStatus;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
    output?: unknown;
    error?: unknown;
    errorMessage?: string;
    /** Time the first output token arrived (streaming TTFT). ISO string or Date. */
    completionStartTime?: string | Date;
    metadata?: Record<string, unknown>;
}

export type ScoreTargetType = "trace" | "span" | "request" | "session" | "end_user";
export type ScoreDataType = "numeric" | "categorical" | "boolean" | "text";

export interface ScoreInput {
    name: string;
    targetType?: ScoreTargetType;
    traceId?: string;
    spanId?: string;
    requestId?: string;
    sessionId?: string;
    endUserId?: string;
    /** Numeric score value. */
    value?: number;
    /** Categorical or text score value. */
    stringValue?: string;
    /** Boolean score value. */
    boolValue?: boolean;
    dataType?: ScoreDataType;
    comment?: string;
    metadata?: Record<string, unknown>;
}

export interface TraceEnvelope {
    trace: {
        traceId: string;
        name?: string;
        serviceName?: string;
        endpoint?: string;
        environment?: string;
        sessionId?: string;
        endUserId?: string;
        release?: string;
        startedAt: string;
        endedAt?: string;
        metadata?: Record<string, unknown>;
        tags?: string[];
        prompt?: PromptContext;
    };
    spans: Array<{
        spanId: string;
        parentSpanId?: string;
        name: string;
        kind: SpanKind;
        provider?: AiProvider;
        model?: string;
        sessionId?: string;
        endUserId?: string;
        status: SpanStatus;
        startedAt: string;
        endedAt?: string;
        durationMs?: number;
        completionStartTime?: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cost?: number;
        errorMessage?: string;
        inputPreview?: string;
        outputPreview?: string;
        promptHash?: string;
        prompt?: PromptContext;
        metadata?: Record<string, unknown>;
    }>;
}

export interface PropagationContext {
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
    sessionId?: string;
    endUserId?: string;
    release?: string;
    tags?: string[];
    prompt?: PromptContext;
}
