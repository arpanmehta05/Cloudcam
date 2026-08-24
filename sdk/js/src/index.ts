import { TelemetryClient } from "./client.js";
import { Trace, TraceSpan } from "./trace.js";
import {
    PromptContext,
    PromptResolveOptions,
    PropagationContext,
    RabbittWatchAIOptions,
    ScoreInput,
    SpanEndOptions,
    TraceOptions,
    RabbittWatchAIPlugin,
} from "./types.js";
import { extractUsage } from "./providers/openai.js";

export * from "./types.js";
export { extractUsage };

function headerValue(headers: Record<string, string>, name: string): string | undefined {
    return headers[name] || headers[name.toLowerCase()];
}

function applyHeader(headers: Record<string, string>, name: string, value: unknown) {
    if (value !== undefined && value !== null && String(value).trim()) {
        headers[name] = String(value);
    }
}

function promptContextFromHeaders(headers: Record<string, string>): PromptContext | undefined {
    const slug = headerValue(headers, "x-rabbittize-prompt-slug");
    const version = headerValue(headers, "x-rabbittize-prompt-version");
    const label = headerValue(headers, "x-rabbittize-prompt-label");
    const hash = headerValue(headers, "x-rabbittize-prompt-hash");
    if (!slug && !version && !label && !hash) return undefined;
    return { slug, version, label, hash };
}

export class RabbittWatchAI {
    private client: TelemetryClient;
    private options: RabbittWatchAIOptions;

    private shutdownHandlersRegistered = false;

    constructor(options: RabbittWatchAIOptions) {
        if (!options.apiKey) throw new Error("RabbittWatchAI requires apiKey");
        this.options = {
            captureInput: false,
            captureOutput: false,
            previewMaxChars: 102400,
            flushIntervalMs: 5000,
            maxBatchSize: 50,
            environment: "prod",
            serviceName: "app",
            ...options,
        };
        this.client = new TelemetryClient(this.options);
        this.registerShutdownFlush();
    }

    /** Flush the buffer when the process is exiting so no traces are lost. */
    private registerShutdownFlush() {
        if (this.shutdownHandlersRegistered) return;
        if (typeof process === "undefined" || typeof process.once !== "function") return;
        this.shutdownHandlersRegistered = true;
        const flushOnce = () => {
            void this.client.flush();
        };
        process.once("beforeExit", flushOnce);
        process.once("SIGTERM", flushOnce);
        process.once("SIGINT", flushOnce);
    }

    /**
     * Attach a score to a trace, span, request, session, or end user.
     * Numeric via `value`, boolean via `boolValue`, categorical/text via `stringValue`.
     */
    async score(input: ScoreInput): Promise<void> {
        const targetType =
            input.targetType ||
            (input.spanId ? "span" : input.requestId ? "request" : input.sessionId ? "session" : input.endUserId ? "end_user" : "trace");
        const dataType =
            input.dataType ||
            (typeof input.boolValue === "boolean" ? "boolean" : input.stringValue !== undefined ? "categorical" : "numeric");
        await this.client.postScore({
            name: input.name,
            targetType,
            dataType,
            traceId: input.traceId,
            spanId: input.spanId,
            requestId: input.requestId,
            sessionId: input.sessionId,
            endUserId: input.endUserId,
            score: input.value,
            stringValue: input.stringValue,
            boolValue: input.boolValue,
            comment: input.comment,
            metadata: input.metadata,
            source: "api",
        });
    }

    use(plugin: RabbittWatchAIPlugin) {
        this.client.plugins.push(plugin);
    }

    injectHeaders(headers: Record<string, string>, context: Trace | TraceSpan): Record<string, string> {
        const propagation = context.toPropagationContext();
        const nextHeaders = { ...headers };
        applyHeader(nextHeaders, "x-rabbittize-trace-id", propagation.traceId);
        applyHeader(nextHeaders, "x-rabbittize-span-id", propagation.spanId);
        applyHeader(nextHeaders, "x-rabbittize-parent-span-id", propagation.parentSpanId);
        applyHeader(nextHeaders, "x-rabbittize-session-id", propagation.sessionId);
        applyHeader(nextHeaders, "x-rabbittize-end-user-id", propagation.endUserId);
        applyHeader(nextHeaders, "x-rabbittize-release", propagation.release);
        applyHeader(nextHeaders, "x-rabbittize-tags", propagation.tags?.join(","));
        applyHeader(nextHeaders, "x-rabbittize-prompt-slug", propagation.prompt?.slug);
        applyHeader(nextHeaders, "x-rabbittize-prompt-version", propagation.prompt?.version);
        applyHeader(nextHeaders, "x-rabbittize-prompt-label", propagation.prompt?.label);
        applyHeader(nextHeaders, "x-rabbittize-prompt-hash", propagation.prompt?.hash || propagation.prompt?.contentHash);
        applyHeader(nextHeaders, "x-opencode-session-id", propagation.sessionId);
        return nextHeaders;
    }

    extractHeaders(headers: Record<string, string>): TraceOptions & PropagationContext {
        const traceId = headerValue(headers, "x-rabbittize-trace-id");
        const parentSpanId =
            headerValue(headers, "x-rabbittize-parent-span-id") || headerValue(headers, "x-rabbittize-span-id");
        const sessionId = headerValue(headers, "x-rabbittize-session-id") || headerValue(headers, "x-opencode-session-id");
        const tags = headerValue(headers, "x-rabbittize-tags")
            ?.split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        return {
            traceId: typeof traceId === "string" ? traceId : undefined,
            parentSpanId: typeof parentSpanId === "string" ? parentSpanId : undefined,
            sessionId,
            endUserId: headerValue(headers, "x-rabbittize-end-user-id"),
            release: headerValue(headers, "x-rabbittize-release"),
            tags: tags?.length ? tags : undefined,
            prompt: promptContextFromHeaders(headers),
            name: "propagated-trace",
            metadata: sessionId ? { sessionId, threadId: sessionId } : {},
        };
    }

    startTrace(options: TraceOptions): Trace {
        return new Trace(this.client, options, this.options);
    }

    async getPrompt(slug: string, options: PromptResolveOptions = {}): Promise<PromptContext> {
        return this.client.resolvePrompt(slug, options);
    }

    async trace<T>(options: TraceOptions, fn: () => Promise<T>): Promise<T> {
        const trace = this.startTrace(options);
        const span = trace.startSpan({
            name: options.name,
            kind: "llm",
            provider: options.provider,
            model: options.model,
            input: options.input,
            prompt: options.prompt,
        });

        try {
            const result = await fn();
            const usage = extractUsage(result);
            span.end({ status: "success", output: result, ...usage });
            void trace.flush();
            return result;
        } catch (error) {
            span.end({ status: "error", error });
            void trace.flush();
            throw error;
        }
    }

    expressMiddleware() {
        return (req: any, res: any, next: any) => {
            const trace = this.startTrace({
                name: `${req.method} ${req.path || req.url}`,
                endpoint: req.path || req.url,
                metadata: { method: req.method },
            });

            req.rabbittwatchTrace = trace;
            const span = trace.startSpan({
                name: "http.request",
                kind: "chain",
                metadata: { method: req.method, url: req.originalUrl || req.url },
            });

            res.on("finish", () => {
                const status = res.statusCode >= 500 ? "error" : "success";
                const end: SpanEndOptions = {
                    status,
                    metadata: { statusCode: res.statusCode },
                };
                span.end(end);
                void trace.flush();
            });

            next();
        };
    }

    async flush(): Promise<void> {
        await this.client.flush();
    }

    /** Flush any buffered traces and stop the background timer. */
    async close(): Promise<void> {
        await this.client.flush();
        this.client.close();
    }
}

export { Trace, TraceSpan };
