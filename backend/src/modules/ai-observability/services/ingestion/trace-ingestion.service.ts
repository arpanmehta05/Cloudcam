import { AiTrace } from "../../../../models/ai-trace.model";
import { AiTraceSpan } from "../../../../models/ai-trace-span.model";
import { AiProvider, AiRequestStatus } from "../../../../models/ai-request-log.model";
import type { AiObservationLevel } from "../../../../models/ai-trace.model";
import { logger } from "../../../../core/logger";
import { resolveModelCost } from "../../pricing";
import * as providerIngestion from "./provider-ingestion.service";
import { normalizePromptMetadata } from "./prompt-metadata";
import { redactObject, redactText, resolveRedactionPolicy } from "./redaction.service";

type SpanKind = "chain" | "tool" | "llm" | "embedding" | "reranker" | "custom" | "event" | "retrieval" | "agent" | "evaluator" | "guardrail";

export interface TraceEnvelope {
    trace: {
        traceId: string;
        tenantId?: string;
        workspaceId?: string;
        environment?: string;
        name?: string;
        serviceName?: string;
        endpoint?: string;
        sessionId?: string;
        endUserId?: string;
        release?: string;
        level?: AiObservationLevel;
        public?: boolean;
        startedAt?: string | Date;
        endedAt?: string | Date;
        metadata?: Record<string, any>;
        prompt?: Record<string, unknown>;
        tags?: string[];
    };
    spans?: Array<{
        spanId: string;
        parentSpanId?: string | null;
        name?: string;
        kind?: SpanKind;
        provider?: AiProvider;
        model?: string;
        modelName?: string;
        status?: AiRequestStatus;
        level?: AiObservationLevel;
        statusMessage?: string;
        startedAt?: string | Date;
        endedAt?: string | Date;
        completionStartTime?: string | Date;
        durationMs?: number;
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
        cost?: number;
        pricingSource?: "provided" | "custom" | "default" | "unpriced";
        pricingEstimated?: boolean;
        unpriced?: boolean;
        errorMessage?: string;
        modelParameters?: Record<string, unknown>;
        endUserId?: string;
        sessionId?: string;
        inputPreview?: string;
        outputPreview?: string;
        promptHash?: string;
        promptName?: string;
        promptSlug?: string;
        promptVersion?: string;
        promptLabel?: string;
        promptEnvironment?: string;
        prompt?: Record<string, unknown>;
        metadata?: Record<string, any>;
    }>;
}

export interface TraceScope {
    userId: string;
    tenantId?: string;
    workspaceId?: string;
    environment?: string;
}

export interface TraceIngestionOptions {
    recordLlmRequests?: boolean;
}

function asDate(value: unknown, fallback = new Date()): Date {
    if (!value) return fallback;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? fallback : date;
}

function durationMs(startedAt: Date, endedAt?: Date | null, explicit?: number): number {
    if (typeof explicit === "number" && Number.isFinite(explicit)) return Math.max(0, Math.round(explicit));
    if (!endedAt) return 0;
    return Math.max(0, endedAt.getTime() - startedAt.getTime());
}

function capText(value: unknown, max = 2000): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
}

function safeObject(value: unknown): Record<string, any> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    return value as Record<string, any>;
}

function normalizeStatus(status: unknown): AiRequestStatus {
    return ["success", "error", "rate_limited", "timeout"].includes(String(status))
        ? String(status) as AiRequestStatus
        : "success";
}

function normalizeKind(kind: unknown): SpanKind {
    const raw = String(kind);
    // "generation" is the Langfuse/OTel-standard name for an LLM call. Map it to
    // our "llm" kind so it is recorded as a request log and flows into the
    // request-log-based tabs (Model Usage, Cost, Prompt Insights, Routing, Audit).
    if (raw === "generation" || raw === "GENERATION") return "llm";
    const kinds = ["chain", "tool", "llm", "embedding", "reranker", "custom", "event", "retrieval", "agent", "evaluator", "guardrail"];
    return kinds.includes(raw)
        ? raw as SpanKind
        : "custom";
}

function normalizeLevel(level: unknown): AiObservationLevel {
    return ["DEBUG", "DEFAULT", "WARNING", "ERROR"].includes(String(level))
        ? String(level) as AiObservationLevel
        : "DEFAULT";
}

function traceStatus(spans: any[]): "success" | "error" | "partial" {
    const errorCount = spans.filter((span) => span.status !== "success").length;
    if (errorCount === 0) return "success";
    if (errorCount === spans.length) return "error";
    return "partial";
}

export async function ingestTrace(
    scope: TraceScope,
    envelope: TraceEnvelope,
    options: TraceIngestionOptions = {}
) {
    if (!envelope?.trace?.traceId) {
        const error = new Error("trace.traceId is required");
        (error as any).status = 400;
        throw error;
    }

    const traceInput = envelope.trace;
    const traceId = String(traceInput.traceId);
    const fallbackStart = new Date();
    const startedAt = asDate(traceInput.startedAt, fallbackStart);
    const endedAt = traceInput.endedAt ? asDate(traceInput.endedAt, startedAt) : undefined;
    const environment = scope.environment || traceInput.environment || "prod";
    const tracePromptMetadata = normalizePromptMetadata(traceInput);
    const redactionPolicy = await resolveRedactionPolicy(scope.userId);

    const normalizedSpans = [];
    for (const span of (envelope.spans || []).slice(0, 100)) {
        const spanStart = asDate(span.startedAt, startedAt);
        const spanEnd = span.endedAt ? asDate(span.endedAt, spanStart) : undefined;
        const promptTokens = Math.max(0, Number(span.promptTokens || 0));
        const completionTokens = Math.max(0, Number(span.completionTokens || 0));
        const totalTokens = Math.max(0, Number(span.totalTokens || promptTokens + completionTokens));
        const provider = span.provider || "custom";
        const modelName = span.modelName || span.model || "unknown";
        const costResult = await resolveModelCost({
            userId: scope.userId,
            workspaceId: scope.workspaceId || traceInput.workspaceId,
            provider,
            modelName,
            promptTokens,
            completionTokens,
            precomputedCost: span.cost,
            pricingSource: span.pricingSource,
            pricingEstimated: span.pricingEstimated,
            unpriced: span.unpriced,
        });
        const promptMetadata = normalizePromptMetadata(span, traceInput);

        const normalizedSpan = {
            tenantId: scope.tenantId || traceInput.tenantId,
            workspaceId: scope.workspaceId || traceInput.workspaceId,
            environment,
            traceId,
            spanId: String(span.spanId),
            parentSpanId: span.parentSpanId ? String(span.parentSpanId) : undefined,
            name: span.name || modelName || "ai.span",
            serviceName: traceInput.serviceName,
            endpoint: traceInput.endpoint,
            kind: normalizeKind(span.kind),
            provider,
            modelName,
            status: normalizeStatus(span.status),
            level: normalizeLevel(span.level),
            statusMessage: capText(span.statusMessage, 1000),
            startedAt: spanStart,
            endedAt: spanEnd,
            completionStartTime: span.completionStartTime ? asDate(span.completionStartTime, spanStart) : undefined,
            durationMs: durationMs(spanStart, spanEnd, span.durationMs),
            promptTokens,
            completionTokens,
            totalTokens,
            cost: Number.isFinite(costResult.cost) ? costResult.cost : 0,
            pricingSource: costResult.pricingSource,
            pricingEstimated: costResult.estimated,
            unpriced: costResult.unpriced,
            errorMessage: capText(redactText(span.errorMessage, redactionPolicy), 1000),
            modelParameters: redactObject(safeObject(span.modelParameters), redactionPolicy),
            endUserId: span.endUserId || traceInput.endUserId,
            sessionId: span.sessionId || traceInput.sessionId,
            inputPreview: capText(redactText(span.inputPreview, redactionPolicy)),
            outputPreview: capText(redactText(span.outputPreview, redactionPolicy)),
            promptHash: promptMetadata.promptHash || capText(span.promptHash, 256),
            promptTemplateId: promptMetadata.promptTemplateId,
            promptVersionId: promptMetadata.promptVersionId,
            promptName: promptMetadata.promptName,
            promptSlug: promptMetadata.promptSlug,
            promptVersion: promptMetadata.promptVersion,
            promptLabel: promptMetadata.promptLabel,
            promptEnvironment: promptMetadata.promptEnvironment,
            promptState: promptMetadata.promptState,
            promptContentHash: promptMetadata.promptContentHash,
            metadata: redactObject(safeObject(span.metadata), redactionPolicy),
            tags: Array.isArray(traceInput.tags) ? traceInput.tags.slice(0, 20) : [],
        };
        if (normalizedSpan.spanId) normalizedSpans.push(normalizedSpan);
    }

    let insertedSpans = 0;
    for (const span of normalizedSpans) {
        const existing = await AiTraceSpan.findOne({ userId: scope.userId, traceId, spanId: span.spanId }).select("_id");
        const { traceId: spanTraceId, spanId: currentSpanId, ...spanUpdate } = span;
        await AiTraceSpan.findOneAndUpdate(
            { userId: scope.userId, traceId, spanId: span.spanId },
            { $set: spanUpdate },
            { upsert: true, returnDocument: "after" }
        );

        if (!existing && span.kind === "llm" && options.recordLlmRequests !== false) {
            await providerIngestion.record({
                userId: scope.userId,
                tenantId: scope.tenantId || traceInput.tenantId,
                workspaceId: scope.workspaceId || traceInput.workspaceId,
                environment,
                serviceName: traceInput.serviceName,
                endpoint: traceInput.endpoint,
                provider: span.provider,
                model: span.modelName,
                requestId: `${traceId}:${span.spanId}`,
                promptTokens: span.promptTokens,
                completionTokens: span.completionTokens,
                totalTokens: span.totalTokens,
                latencyMs: span.durationMs,
                cost: span.cost,
                pricingSource: span.pricingSource,
                pricingEstimated: span.pricingEstimated,
                unpriced: span.unpriced,
                status: span.status,
                errorMessage: span.errorMessage,
                traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                sessionId: span.sessionId,
                endUserId: span.endUserId,
                completionStartTime: span.completionStartTime,
                modelParameters: span.modelParameters,
                operationName: span.name,
                inputPreview: span.inputPreview,
                outputPreview: span.outputPreview,
                promptHash: span.promptHash,
                promptTemplateId: span.promptTemplateId,
                promptVersionId: span.promptVersionId,
                promptName: span.promptName,
                promptSlug: span.promptSlug,
                promptVersion: span.promptVersion,
                promptLabel: span.promptLabel,
                promptEnvironment: span.promptEnvironment,
                promptState: span.promptState,
                promptContentHash: span.promptContentHash,
                tags: traceInput.tags,
                metadata: { ...span.metadata, source: "trace_ingestion", redactionPolicy },
            });
            insertedSpans++;
        }
    }

    const allSpans = await AiTraceSpan.find({ userId: scope.userId, traceId }).lean();
    const totalCost = allSpans.reduce((sum, span: any) => sum + (span.cost || 0), 0);
    const totalTokens = allSpans.reduce((sum, span: any) => sum + (span.totalTokens || 0), 0);
    const errorCount = allSpans.filter((span: any) => span.status !== "success").length;
    const unpricedSpanCount = allSpans.filter((span: any) => span.unpriced).length;
    const pricingSources = [...new Set(allSpans.map((span: any) => span.pricingSource).filter(Boolean))];
    const latestEnd = allSpans
        .map((span: any) => span.endedAt || span.startedAt)
        .filter(Boolean)
        .sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())[0];
    const effectiveEndedAt = endedAt || latestEnd;
    const firstPromptSpan = allSpans.find((span: any) => span.promptName || span.promptSlug || span.promptVersionId);
    const tracePromptFields = {
        promptTemplateId: tracePromptMetadata.promptTemplateId || firstPromptSpan?.promptTemplateId,
        promptVersionId: tracePromptMetadata.promptVersionId || firstPromptSpan?.promptVersionId,
        promptName: tracePromptMetadata.promptName || firstPromptSpan?.promptName,
        promptSlug: tracePromptMetadata.promptSlug || firstPromptSpan?.promptSlug,
        promptVersion: tracePromptMetadata.promptVersion || firstPromptSpan?.promptVersion,
        promptLabel: tracePromptMetadata.promptLabel || firstPromptSpan?.promptLabel,
        promptEnvironment: tracePromptMetadata.promptEnvironment || firstPromptSpan?.promptEnvironment,
        promptState: tracePromptMetadata.promptState || firstPromptSpan?.promptState,
        promptContentHash: tracePromptMetadata.promptContentHash || firstPromptSpan?.promptContentHash,
        promptHash: tracePromptMetadata.promptHash || firstPromptSpan?.promptHash,
    };

    const trace = await AiTrace.findOneAndUpdate(
        { userId: scope.userId, traceId },
        {
            $set: {
                tenantId: scope.tenantId || traceInput.tenantId,
                workspaceId: scope.workspaceId || traceInput.workspaceId,
                environment,
                name: traceInput.name,
                serviceName: traceInput.serviceName,
                endpoint: traceInput.endpoint,
                sessionId: traceInput.sessionId,
                endUserId: traceInput.endUserId,
                release: traceInput.release,
                level: normalizeLevel(traceInput.level),
                public: traceInput.public || false,
                status: allSpans.length ? traceStatus(allSpans) : "success",
                startedAt,
                endedAt: effectiveEndedAt,
                durationMs: durationMs(startedAt, effectiveEndedAt),
                totalCost,
                totalTokens,
                errorCount,
                spanCount: allSpans.length,
                unpricedSpanCount,
                pricingSources,
                ...tracePromptFields,
                metadata: redactObject(safeObject(traceInput.metadata), redactionPolicy),
                tags: Array.isArray(traceInput.tags) ? traceInput.tags.slice(0, 20) : [],
            },
        },
        { upsert: true, returnDocument: "after" }
    );

    return { trace, spanCount: allSpans.length, insertedSpans };
}

export async function ingestTraceBatch(scope: TraceScope, envelopes: TraceEnvelope[]) {
    let ingested = 0;
    let errors = 0;

    for (const envelope of envelopes.slice(0, 50)) {
        try {
            await ingestTrace(scope, envelope);
            ingested++;
        } catch (error) {
            logger.error("ai trace batch ingest error:", error);
            errors++;
        }
    }

    return { ingested, errors };
}
