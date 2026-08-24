import {
    PromptContext,
    PromptResolveOptions,
    RabbittWatchAIOptions,
    RabbittWatchAIPlugin,
    TraceEnvelope,
} from "./types.js";

const DEFAULT_ENDPOINT = "https://rabbitize-api.rabbitt.ai";

interface PromptCacheEntry {
    context: PromptContext;
    expiresAt: number;
}

export class TelemetryClient {
    public plugins: RabbittWatchAIPlugin[] = [];
    private queue: TraceEnvelope[] = [];
    private timer?: ReturnType<typeof setInterval>;
    private promptCache = new Map<string, PromptCacheEntry>();
    private options: Required<Pick<RabbittWatchAIOptions, "endpoint" | "maxBatchSize" | "flushIntervalMs" | "debug" | "retries" | "promptCacheTtlMs">> & { apiKey: string };

    constructor(options: RabbittWatchAIOptions) {
        this.options = {
            apiKey: options.apiKey,
            endpoint: (options.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, ""),
            maxBatchSize: options.maxBatchSize ?? 50,
            flushIntervalMs: options.flushIntervalMs ?? 5000,
            debug: options.debug ?? false,
            retries: options.retries ?? 2,
            promptCacheTtlMs: options.promptCacheTtlMs ?? 60_000,
        };

        if (this.options.flushIntervalMs > 0) {
            this.timer = setInterval(() => void this.flush(), this.options.flushIntervalMs);
            (this.timer as any).unref?.();
        }
    }

    enqueue(envelope: TraceEnvelope) {
        this.queue.push(envelope);
        if (this.queue.length >= this.options.maxBatchSize) void this.flush();
    }

    async send(envelope: TraceEnvelope): Promise<void> {
        await this.post("/api/ai-observability/traces", envelope);
    }

    async resolvePrompt(slug: string, options: PromptResolveOptions = {}): Promise<PromptContext> {
        const params = new URLSearchParams();
        if (options.version) params.set("version", options.version);
        if (options.label) params.set("label", options.label);
        if (options.environment) params.set("environment", options.environment);
        if (options.state) params.set("state", options.state);
        const query = params.toString() ? `?${params.toString()}` : "";
        const cacheKey = `${slug}${query}`;
        const ttl = options.cacheTtlMs ?? this.options.promptCacheTtlMs;
        const cached = this.promptCache.get(cacheKey);

        if (cached && ttl > 0 && cached.expiresAt > Date.now()) {
            return cached.context;
        }

        try {
            const response = await this.getJson<any>(`/api/prompts/registry/${encodeURIComponent(slug)}/resolve${query}`);
            const prompt = response.prompt || {};
            const version = response.version || {};
            const context: PromptContext = {
                templateId: String(prompt._id || version.templateId || ""),
                versionId: String(version._id || ""),
                slug: version.slug || prompt.slug || slug,
                version: version.version,
                label: options.label,
                environment: version.environment || options.environment,
                state: version.state,
                contentHash: version.contentHash,
                hash: version.contentHash,
                template: version.template,
                systemPrompt: version.systemPrompt,
                variables: version.variables,
                metadata: { prompt, version },
            };
            this.promptCache.set(cacheKey, { context, expiresAt: Date.now() + Math.max(ttl, 0) });
            return context;
        } catch (error) {
            // Keep serving the last known good prompt when the API is unavailable.
            if (cached) {
                this.log(`prompt resolve failed; serving stale cache for ${slug}`, error);
                return cached.context;
            }
            if (options.fallback) {
                this.log(`prompt resolve failed; using inline fallback for ${slug}`, error);
                return {
                    slug,
                    label: options.label,
                    environment: options.environment,
                    template: options.fallback.template,
                    systemPrompt: options.fallback.systemPrompt,
                    variables: options.fallback.variables,
                    version: options.fallback.version,
                    metadata: { fallback: true },
                };
            }
            throw error;
        }
    }

    async postScore(payload: Record<string, unknown>): Promise<void> {
        await this.post("/api/ai-observability/scores", payload);
    }

    async flush(): Promise<void> {
        if (this.queue.length === 0) return;
        const batch = this.queue.splice(0, this.options.maxBatchSize);

        // Run plugin onFlush hooks
        for (const envelope of batch) {
            for (const plugin of this.plugins) {
                try {
                    plugin.onFlush?.(envelope);
                } catch (e) {
                    this.log(`Plugin ${plugin.name} error in onFlush`, e);
                }
            }
        }

        try {
            if (batch.length === 1) {
                await this.send(batch[0]);
            } else {
                await this.post("/api/ai-observability/traces/batch", { traces: batch });
            }
        } catch (error) {
            this.queue.unshift(...batch);
            this.log("telemetry flush failed", error);
        }
    }

    close() {
        if (this.timer) clearInterval(this.timer);
    }

    private async post(path: string, body: unknown): Promise<void> {
        let lastError: unknown;
        for (let attempt = 0; attempt <= this.options.retries; attempt++) {
            try {
                const response = await fetch(`${this.options.endpoint}${path}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Rabbittize-Ingest-Key": this.options.apiKey,
                    },
                    body: JSON.stringify(body),
                });

                if (!response.ok) throw new Error(`RabbittWatch telemetry HTTP ${response.status}`);
                return;
            } catch (error) {
                lastError = error;
                if (attempt < this.options.retries) {
                    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
                }
            }
        }

        throw lastError;
    }

    private async getJson<T>(path: string): Promise<T> {
        const response = await fetch(`${this.options.endpoint}${path}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-Rabbittize-Ingest-Key": this.options.apiKey,
            },
        });
        if (!response.ok) throw new Error(`RabbittWatch prompt HTTP ${response.status}`);
        const body = await response.json();
        return body?.data || body;
    }

    private log(message: string, detail: unknown) {
        if (this.options.debug) console.warn(`[rabbittwatch] ${message}`, detail);
    }
}
