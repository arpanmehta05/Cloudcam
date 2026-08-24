import { logger } from "../../../../core/logger";
import { AiDailyMetric } from "../../../../models/ai-daily-metric.model";
import { AiRequestLog, AiProvider } from "../../../../models/ai-request-log.model";
import {
    anthropicAdapter,
    bedrockAdapter,
    geminiAdapter,
    openaiAdapter,
    type AiProviderAdapter,
    type NormalizedAiResponse,
} from "../../../../integrations/ai-providers";
import { resolveModelCost } from "../../pricing";
import { buildGenericError, buildGenericSuccess } from "./generic-provider-adapter";
import { normalizePromptMetadata, type NormalizedPromptMetadata } from "./prompt-metadata";
import type { ExecuteOptions, ManualEventInput, PersistRecordScope } from "./provider-ingestion.types";
import { redactObject, redactText, resolveRedactionPolicy } from "./redaction.service";

const adapters: Record<string, AiProviderAdapter> = {
    openai: openaiAdapter,
    gemini: geminiAdapter,
    anthropic: anthropicAdapter,
    bedrock: bedrockAdapter,
};

function getAdapter(provider: string): AiProviderAdapter | null {
    return adapters[provider] || null;
}

export async function execute<T = unknown>(options: ExecuteOptions<T>): Promise<T> {
    const { provider, model, userId, requestFn, metadata } = options;
    const adapter = getAdapter(provider);
    const startTime = Date.now();

    try {
        const response = await requestFn();
        const latencyMs = Date.now() - startTime;
        const normalized = adapter
            ? adapter.parseSuccessResponse(response, { model, ...metadata })
            : buildGenericSuccess(provider, model, response, metadata);
        persistRecord(userId, normalized, latencyMs, undefined, options).catch((err) =>
            logger.error("[ai-ingestion] Failed to persist success record:", err),
        );
        return response;
    } catch (error) {
        const latencyMs = Date.now() - startTime;
        const normalized = adapter
            ? adapter.parseErrorResponse(error, { model, ...metadata })
            : buildGenericError(provider, model, error, metadata);
        persistRecord(userId, normalized, latencyMs, undefined, options).catch((err) =>
            logger.error("[ai-ingestion] Failed to persist error record:", err),
        );
        throw error;
    }
}

export async function record(event: ManualEventInput) {
    const promptTokens = event.promptTokens || 0;
    const completionTokens = event.completionTokens || 0;
    const totalTokens = event.totalTokens || promptTokens + completionTokens;
    const costResult = await resolveCost(event.userId, event.workspaceId, event.provider, event.model, promptTokens, completionTokens, event);
    const redactionPolicy = await resolveRedactionPolicy(event.userId);

    const normalized: NormalizedAiResponse = {
        provider: event.provider,
        modelName: event.model,
        requestId: event.requestId || `${event.provider}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        promptTokens,
        completionTokens,
        totalTokens,
        status: event.status || "success",
        errorMessage: redactText(event.errorMessage, redactionPolicy),
        metadata: {
            ...redactObject(event.metadata, redactionPolicy),
            costEstimated: costResult.estimated,
            pricingSource: costResult.pricingSource,
            unpriced: costResult.unpriced,
            source: "manual_event",
            redactionPolicy,
        },
    };

    return persistRecord(event.userId, normalized, event.latencyMs || 0, costResult.cost, {
        ...event,
        pricingSource: costResult.pricingSource,
        pricingEstimated: costResult.estimated,
        unpriced: costResult.unpriced,
    });
}

export async function ingest(events: ManualEventInput[]): Promise<{ ingested: number; errors: number }> {
    let ingested = 0;
    let errors = 0;
    for (const event of events) {
        try {
            await record(event);
            ingested++;
        } catch (err) {
            logger.error(`[ai-ingestion] Batch ingest error for ${event.provider}/${event.model}:`, err);
            errors++;
        }
    }
    return { ingested, errors };
}

async function resolveCost(
    userId: string,
    workspaceId: string | undefined,
    provider: string,
    modelName: string,
    promptTokens: number,
    completionTokens: number,
    source?: Pick<PersistRecordScope, "cost" | "pricingSource" | "pricingEstimated" | "unpriced">,
) {
    return resolveModelCost({
        userId,
        workspaceId,
        provider,
        modelName,
        promptTokens,
        completionTokens,
        precomputedCost: source?.cost,
        pricingSource: source?.pricingSource,
        pricingEstimated: source?.pricingEstimated,
        unpriced: source?.unpriced,
    });
}

async function persistRecord(
    userId: string,
    normalized: NormalizedAiResponse,
    latencyMs: number,
    precomputedCost?: number,
    scope?: PersistRecordScope,
) {
    const costResult = await resolveCost(
        userId,
        scope?.workspaceId,
        normalized.provider,
        normalized.modelName,
        normalized.promptTokens,
        normalized.completionTokens,
        {
            cost: precomputedCost,
            pricingSource: scope?.pricingSource,
            pricingEstimated: scope?.pricingEstimated,
            unpriced: scope?.unpriced,
        },
    );
    const promptMetadata: NormalizedPromptMetadata = normalizePromptMetadata(scope, { metadata: scope?.metadata });
    const redactionPolicy = await resolveRedactionPolicy(userId);
    const redactedScopeMetadata = redactObject(scope?.metadata, redactionPolicy);
    const redactedNormalizedMetadata = redactObject(normalized.metadata, redactionPolicy);
    const logEntry = await AiRequestLog.create({
        userId,
        tenantId: scope?.tenantId,
        workspaceId: scope?.workspaceId,
        environment: scope?.environment || "prod",
        serviceName: scope?.serviceName,
        endpoint: scope?.endpoint,
        provider: normalized.provider,
        modelName: normalized.modelName,
        requestId: normalized.requestId,
        promptTokens: normalized.promptTokens,
        completionTokens: normalized.completionTokens,
        totalTokens: normalized.totalTokens,
        latencyMs,
        cost: costResult.cost,
        pricingSource: costResult.pricingSource,
        pricingEstimated: costResult.estimated,
        unpriced: costResult.unpriced,
        status: normalized.status,
        errorMessage: redactText(normalized.errorMessage, redactionPolicy) || undefined,
        traceId: scope?.traceId,
        spanId: scope?.spanId,
        parentSpanId: scope?.parentSpanId,
        sessionId: scope?.sessionId,
        endUserId: scope?.endUserId,
        completionStartTime: scope?.completionStartTime,
        modelParameters: redactObject(scope?.modelParameters, redactionPolicy),
        operationName: scope?.operationName,
        inputPreview: redactText(scope?.inputPreview, redactionPolicy),
        outputPreview: redactText(scope?.outputPreview, redactionPolicy),
        promptHash: promptMetadata.promptHash || scope?.promptHash,
        promptTemplateId: promptMetadata.promptTemplateId,
        promptVersionId: promptMetadata.promptVersionId,
        promptName: promptMetadata.promptName,
        promptSlug: promptMetadata.promptSlug,
        promptVersion: promptMetadata.promptVersion,
        promptLabel: promptMetadata.promptLabel,
        promptEnvironment: promptMetadata.promptEnvironment,
        promptState: promptMetadata.promptState,
        promptContentHash: promptMetadata.promptContentHash,
        tags: scope?.tags || [],
        metadata: {
            ...redactedNormalizedMetadata,
            ...redactedScopeMetadata,
            costEstimated: costResult.estimated,
            pricingSource: costResult.pricingSource,
            unpriced: costResult.unpriced,
            customPriceId: costResult.customPriceId,
            redactionPolicy,
        },
    });

    if (logEntry.status === "success" && logEntry.inputPreview && logEntry.outputPreview) {
        const onlineEvalContext = {
            environment: logEntry.environment,
            provider: normalized.provider,
            model: normalized.modelName,
            promptSlug: (logEntry.metadata as Record<string, unknown>)?.promptSlug as string | undefined,
            endpoint: logEntry.endpoint,
            status: logEntry.status,
            cost: costResult.cost,
        };
        import("../../../../services/ai-evaluation.service")
            .then((module) => module.sampleAndEvaluate(userId, logEntry.requestId, onlineEvalContext)
                .catch((err) => logger.error("[ai-ingestion] Background evaluation failed:", err)))
            .catch((err) => logger.error("[ai-ingestion] Failed to import evaluation service:", err));
    }

    await upsertDailyMetric(userId, normalized, latencyMs, costResult.cost, scope);
    return logEntry;
}

async function upsertDailyMetric(
    userId: string,
    normalized: NormalizedAiResponse,
    latencyMs: number,
    cost: number,
    scope?: PersistRecordScope,
) {
    const today = new Date().toISOString().slice(0, 10);
    const doc = await AiDailyMetric.findOneAndUpdate(
        {
            userId,
            tenantId: scope?.tenantId || null,
            workspaceId: scope?.workspaceId || null,
            environment: scope?.environment || "prod",
            date: today,
            provider: normalized.provider,
        },
        {
            $inc: {
                requests: 1,
                promptTokens: normalized.promptTokens,
                completionTokens: normalized.completionTokens,
                totalTokens: normalized.totalTokens,
                totalCost: cost,
                errorCount: normalized.status !== "success" ? 1 : 0,
            },
            $setOnInsert: {
                tenantId: scope?.tenantId || null,
                workspaceId: scope?.workspaceId || null,
                environment: scope?.environment || "prod",
            },
        },
        { upsert: true, returnDocument: "after" },
    );
    if (!doc || doc.requests <= 0) return;
    const avgLatencyMs = Math.round(((doc.avgLatencyMs * (doc.requests - 1)) + latencyMs) / doc.requests);
    await AiDailyMetric.updateOne({ _id: doc._id }, { $set: { avgLatencyMs } });
}
