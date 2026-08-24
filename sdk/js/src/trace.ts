import {
    PropagationContext,
    RabbittWatchAIOptions,
    SpanEndOptions,
    SpanOptions,
    TraceEnvelope,
    TraceOptions,
} from "./types.js";
import { TelemetryClient } from "./client.js";
import { extractUsage } from "./providers/openai.js";

function id(prefix: string): string {
    const random = Math.random().toString(36).slice(2, 14);
    return `${prefix}_${Date.now().toString(36)}${random}`;
}

function stringifyPreview(value: unknown, max: number): string | undefined {
    if (value === undefined || value === null) return undefined;
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    return raw.slice(0, max);
}

function promptHash(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 5381;
    for (let idx = 0; idx < raw.length; idx++) {
        hash = ((hash << 5) + hash) ^ raw.charCodeAt(idx);
    }
    return `djb2_${(hash >>> 0).toString(16)}`;
}

function redactText(text: string, config?: RabbittWatchAIOptions): string {
    if (!text) return text;
    let result = text;
    
    // 1. Default regex rules
    result = result
        .replace(/sk-[A-Za-z0-9_-]{12,}/g, "sk_[redacted]")
        .replace(/AKIA[0-9A-Z]{16}/g, "AKIA[redacted]")
        .replace(/(api[_-]?key|authorization|password)["':=\s]+[^"',\s]+/gi, "$1=[redacted]");

    // 2. Custom regex patterns
    if (config?.redactPatterns) {
        for (const pattern of config.redactPatterns) {
            result = result.replace(pattern, "[redacted]");
        }
    }

    // 3. Custom redact function
    if (config?.customRedactFn) {
        try {
            result = config.customRedactFn(result);
        } catch {
            // Safe fallback if customRedactFn throws
        }
    }

    return result;
}

function deepRedact(value: unknown, config?: RabbittWatchAIOptions, depth = 0): unknown {
    if (depth > 20) return "[Max Depth Exceeded]";
    if (value === undefined || value === null) return value;

    if (typeof value === "string") {
        return redactText(value, config);
    }

    if (Array.isArray(value)) {
        return value.map(item => deepRedact(item, config, depth + 1));
    }

    if (typeof value === "object") {
        const result: Record<string, unknown> = {};
        const sensitiveKeyPattern = /api[_-]?key|authorization|password|token|secret/i;
        
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            if (sensitiveKeyPattern.test(key)) {
                result[key] = "[redacted]";
            } else {
                result[key] = deepRedact(val, config, depth + 1);
            }
        }
        return result;
    }

    return value;
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function metadataString(metadata: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
    for (const key of keys) {
        const value = metadata?.[key];
        if (typeof value === "string" && value.trim()) return value;
    }
    return undefined;
}

export class TraceSpan {
    private readonly startedAt = new Date();
    private ended = false;
    private firstTokenAt?: Date;
    private data: TraceEnvelope["spans"][number];

    constructor(private trace: Trace, options: SpanOptions, private config: RabbittWatchAIOptions) {
        const sanitizedInput = config.captureInput ? deepRedact(options.input, config) : undefined;
        const inputPreview = config.captureInput ? stringifyPreview(sanitizedInput, config.previewMaxChars ?? 102400) : undefined;
        this.data = {
            spanId: options.spanId || id("span"),
            parentSpanId: options.parentSpanId,
            name: options.name,
            kind: options.kind || "llm",
            provider: options.provider,
            model: options.model,
            sessionId: options.sessionId || this.trace.context.sessionId,
            endUserId: options.endUserId || this.trace.context.endUserId,
            status: "success",
            startedAt: this.startedAt.toISOString(),
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            inputPreview: inputPreview ? redactText(inputPreview, config) : undefined,
            promptHash: promptHash(options.input),
            prompt: options.prompt,
            metadata: options.metadata,
        };

        // Invoke plugin onSpanStart hooks (passing frozen options copy)
        const plugins = (this.trace as any).client.plugins;
        for (const plugin of plugins) {
            try {
                plugin.onSpanStart?.(this, { ...options });
            } catch (e) {
                if (config.debug) console.warn(`[rabbittwatch] Plugin ${plugin.name} error in onSpanStart`, e);
            }
        }
    }

    /** Mark the arrival of the first streamed output token (TTFT). */
    firstToken(at: Date = new Date()) {
        if (!this.firstTokenAt) this.firstTokenAt = at;
    }

    end(options: SpanEndOptions = {}) {
        if (this.ended) return;
        this.ended = true;
        const endedAt = new Date();
        const completionStartTime =
            options.completionStartTime
                ? new Date(options.completionStartTime)
                : this.firstTokenAt;
        const usage = extractUsage(options.output);
        const promptTokens = options.promptTokens ?? usage.promptTokens ?? 0;
        const completionTokens = options.completionTokens ?? usage.completionTokens ?? 0;
        
        const sanitizedOutput = this.config.captureOutput ? deepRedact(options.output, this.config) : undefined;
        const outputPreview = this.config.captureOutput
            ? stringifyPreview(sanitizedOutput, this.config.previewMaxChars ?? 102400)
            : undefined;

        this.data = {
            ...this.data,
            status: options.status || (options.error ? "error" : "success"),
            endedAt: endedAt.toISOString(),
            durationMs: endedAt.getTime() - this.startedAt.getTime(),
            completionStartTime: completionStartTime ? completionStartTime.toISOString() : undefined,
            promptTokens,
            completionTokens,
            totalTokens: options.totalTokens ?? usage.totalTokens ?? (promptTokens + completionTokens),
            cost: options.cost,
            errorMessage: options.errorMessage || (options.error ? errorMessage(options.error) : undefined),
            outputPreview: outputPreview ? redactText(outputPreview, this.config) : undefined,
            metadata: { ...this.data.metadata, ...options.metadata },
        };

        this.trace.addSpan(this.data);

        // Invoke plugin onSpanEnd hooks (passing frozen options copy)
        const plugins = (this.trace as any).client.plugins;
        for (const plugin of plugins) {
            try {
                plugin.onSpanEnd?.(this, { ...options });
            } catch (e) {
                if (this.config.debug) console.warn(`[rabbittwatch] Plugin ${plugin.name} error in onSpanEnd`, e);
            }
        }
    }

    get spanId() {
        return this.data.spanId;
    }

    toPropagationContext(): PropagationContext {
        return {
            ...this.trace.toPropagationContext(),
            spanId: this.data.spanId,
            parentSpanId: this.data.spanId,
        };
    }
}

export class Trace {
    readonly traceId: string;
    private readonly startedAt = new Date();
    private spans: TraceEnvelope["spans"] = [];
    private flushed = false;

    constructor(private client: TelemetryClient, private options: TraceOptions, private config: RabbittWatchAIOptions) {
        this.traceId = options.traceId || id("trace");

        // Invoke plugin onTraceStart hooks (passing frozen options copy)
        const plugins = this.client.plugins;
        for (const plugin of plugins) {
            try {
                plugin.onTraceStart?.(this, { ...options });
            } catch (e) {
                if (config.debug) console.warn(`[rabbittwatch] Plugin ${plugin.name} error in onTraceStart`, e);
            }
        }
    }

    startSpan(options: SpanOptions): TraceSpan {
        return new TraceSpan(this, options, this.config);
    }

    addSpan(span: TraceEnvelope["spans"][number]) {
        this.spans.push(span);
    }

    toEnvelope(): TraceEnvelope {
        return {
            trace: {
                traceId: this.traceId,
                name: this.options.name,
                serviceName: this.options.serviceName || this.config.serviceName || "app",
                endpoint: this.options.endpoint,
                environment: this.options.environment || this.config.environment || "prod",
                sessionId: this.options.sessionId,
                endUserId: this.options.endUserId,
                release: this.options.release,
                startedAt: this.startedAt.toISOString(),
                endedAt: new Date().toISOString(),
                metadata: this.options.metadata,
                tags: this.options.tags,
                prompt: this.options.prompt,
            },
            spans: this.spans,
        };
    }

    get context(): PropagationContext {
        const metadata = this.options.metadata;
        return {
            traceId: this.traceId,
            sessionId: this.options.sessionId || metadataString(metadata, "sessionId", "threadId"),
            endUserId: this.options.endUserId || metadataString(metadata, "endUserId", "userId"),
            release: this.options.release,
            tags: this.options.tags,
            prompt: this.options.prompt,
        };
    }

    toPropagationContext(): PropagationContext {
        return this.context;
    }

    async flush(): Promise<void> {
        if (this.flushed) return;
        this.flushed = true;
        this.client.enqueue(this.toEnvelope());

        // Invoke plugin onTraceEnd hooks
        const plugins = this.client.plugins;
        for (const plugin of plugins) {
            try {
                plugin.onTraceEnd?.(this);
            } catch (e) {
                if (this.config.debug) console.warn(`[rabbittwatch] Plugin ${plugin.name} error in onTraceEnd`, e);
            }
        }

        await this.client.flush();
    }
}
