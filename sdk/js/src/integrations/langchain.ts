import { BaseTracer, Run } from "@langchain/core/tracers/base";
import { RabbittWatchAI } from "../index.js";
import { TraceEnvelope } from "../types.js";

export class RabbittWatchLangChainTracer extends BaseTracer {
    name = "RabbittWatchLangChainTracer";

    constructor(
        private rwAI: RabbittWatchAI,
        private options: {
            environment?: string;
            serviceName?: string;
            tags?: string[];
        } = {}
    ) {
        super();
    }

    protected async persistRun(run: Run): Promise<void> {
        const spans: any[] = [];
        this.collectSpans(run, null, spans);

        const startedAt = new Date(run.start_time).toISOString();
        const endedAt = run.end_time ? new Date(run.end_time).toISOString() : new Date().toISOString();

        const envelope: TraceEnvelope = {
            trace: {
                traceId: run.id,
                name: run.name,
                serviceName: this.options.serviceName || (this.rwAI as any).options.serviceName || "app",
                environment: this.options.environment || (this.rwAI as any).options.environment || "prod",
                startedAt,
                endedAt,
                tags: this.options.tags,
            },
            spans,
        };

        // Enqueue trace data to TelemetryClient
        (this.rwAI as any).client.enqueue(envelope);
    }

    private collectSpans(run: Run, parentSpanId: string | null, spans: any[]) {
        const startedAt = new Date(run.start_time).toISOString();
        const endedAt = run.end_time ? new Date(run.end_time).toISOString() : undefined;
        const durationMs = run.end_time ? run.end_time - run.start_time : 0;

        let kind: "chain" | "tool" | "llm" | "custom" = "custom";
        if (run.run_type === "llm") kind = "llm";
        else if (run.run_type === "chain") kind = "chain";
        else if (run.run_type === "tool") kind = "tool";

        const { promptTokens, completionTokens, totalTokens } = this.getTokens(run);

        const captureInput = (this.rwAI as any).options.captureInput;
        const captureOutput = (this.rwAI as any).options.captureOutput;
        const maxChars = (this.rwAI as any).options.previewMaxChars ?? 102400;

        const inputPreview = captureInput && run.inputs ? JSON.stringify(run.inputs).slice(0, maxChars) : undefined;
        const outputPreview = captureOutput && run.outputs ? JSON.stringify(run.outputs).slice(0, maxChars) : undefined;

        spans.push({
            spanId: run.id,
            parentSpanId,
            name: run.name,
            kind,
            provider: run.extra?.metadata?.ls_provider || run.extra?.invocation_params?._type || undefined,
            model: run.extra?.metadata?.ls_model_name || run.extra?.invocation_params?.model_name || undefined,
            status: run.error ? "error" : "success",
            startedAt,
            endedAt,
            durationMs,
            promptTokens,
            completionTokens,
            totalTokens,
            errorMessage: run.error || undefined,
            inputPreview,
            outputPreview,
            metadata: {
                run_type: run.run_type,
                extra: run.extra,
            }
        });

        if (run.child_runs) {
            for (const child of run.child_runs) {
                this.collectSpans(child, run.id, spans);
            }
        }
    }

    private getTokens(run: Run) {
        let promptTokens = 0;
        let completionTokens = 0;

        if (run.run_type === "llm") {
            const usage = run.outputs?.llmOutput?.tokenUsage || 
                          run.outputs?.tokenUsage ||
                          run.outputs?.generations?.[0]?.[0]?.generationInfo?.tokenUsage ||
                          run.outputs?.generations?.[0]?.[0]?.message?.usage_metadata;
            if (usage) {
                promptTokens = usage.promptTokens || usage.prompt_tokens || usage.input_tokens || 0;
                completionTokens = usage.completionTokens || usage.completion_tokens || usage.output_tokens || 0;
            }
        }

        return {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens
        };
    }
}
