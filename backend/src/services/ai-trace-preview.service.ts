import { AiRequestLog } from "../models/ai-request-log.model";
import { AiTraceSpan } from "../models/ai-trace-span.model";
import { AiScope } from "./ai-scope.service";

export interface TracePreviewSource {
    inputPreview?: string | null;
    outputPreview?: string | null;
    spanId?: string | null;
    requestId?: string | null;
    kind?: string | null;
    provider?: string | null;
    modelName?: string | null;
}

export interface TraceListRow {
    traceId: string;
    inputPreview?: string | null;
    outputPreview?: string | null;
    promptPreview?: string | null;
    previewSource?: TracePreviewSource | null;
    [key: string]: unknown;
}

function preferPromptPreview(current: TracePreviewSource | undefined, next: TracePreviewSource) {
    if (!current) return next;
    if (current.kind !== "llm" && next.kind === "llm") return next;
    return current;
}

export async function attachPromptPreviews(scope: AiScope, traces: TraceListRow[]) {
    const traceIds = traces.map((trace) => trace.traceId).filter(Boolean);
    if (traceIds.length === 0) return traces;

    const [spans, requests] = await Promise.all([
        AiTraceSpan.find({
            userId: scope.userId,
            traceId: { $in: traceIds },
            inputPreview: { $nin: [null, ""] },
        })
            .sort({ startedAt: 1 })
            .select({ traceId: 1, spanId: 1, kind: 1, provider: 1, modelName: 1, inputPreview: 1, outputPreview: 1 })
            .lean(),
        AiRequestLog.find({
            userId: scope.userId,
            traceId: { $in: traceIds },
            inputPreview: { $nin: [null, ""] },
        })
            .sort({ createdAt: 1 })
            .select({ traceId: 1, requestId: 1, provider: 1, modelName: 1, inputPreview: 1, outputPreview: 1 })
            .lean(),
    ]);

    const byTraceId = new Map<string, TracePreviewSource>();
    for (const span of spans) {
        if (!span.traceId) continue;
        byTraceId.set(span.traceId, preferPromptPreview(byTraceId.get(span.traceId), {
            inputPreview: span.inputPreview,
            outputPreview: span.outputPreview,
            spanId: span.spanId,
            kind: span.kind,
            provider: span.provider,
            modelName: span.modelName,
        }));
    }
    for (const request of requests) {
        if (!request.traceId || byTraceId.has(request.traceId)) continue;
        byTraceId.set(request.traceId, {
            inputPreview: request.inputPreview,
            outputPreview: request.outputPreview,
            requestId: request.requestId,
            provider: request.provider,
            modelName: request.modelName,
        });
    }

    return traces.map((trace) => {
        const preview = byTraceId.get(trace.traceId);
        return preview
            ? { ...trace, inputPreview: preview.inputPreview, outputPreview: preview.outputPreview, promptPreview: preview.inputPreview, previewSource: preview }
            : trace;
    });
}
