import { AiTrace } from "../../../models/ai-trace.model";
import { AiScope, buildScopeMatch } from "../../../services/ai-scope.service";
import { attachPromptPreviews, type TraceListRow } from "../../../services/ai-trace-preview.service";

function parseDate(value: unknown): Date | undefined {
    if (typeof value !== "string" || !value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function listTraces(scope: AiScope, filters: Record<string, unknown>) {
    const match: Record<string, unknown> = buildScopeMatch(scope);

    if (filters.status && filters.status !== "all") match.status = filters.status;
    if (filters.serviceName) match.serviceName = filters.serviceName;
    if (filters.endpoint) match.endpoint = filters.endpoint;
    if (filters.sessionId) match.sessionId = String(filters.sessionId);
    if (filters.endUserId) match.endUserId = String(filters.endUserId);
    if (filters.level) match.level = String(filters.level);
    if (filters.environment) match.environment = String(filters.environment);
    if (filters.tag) match.tags = String(filters.tag);
    if (filters.traceId) match.traceId = { $regex: String(filters.traceId), $options: "i" };
    if (filters.name) match.name = { $regex: String(filters.name), $options: "i" };
    if (filters.promptName) match.promptName = String(filters.promptName);
    if (filters.promptSlug) match.promptSlug = String(filters.promptSlug);
    if (filters.promptVersion) match.promptVersion = String(filters.promptVersion);
    if (filters.promptLabel) match.promptLabel = String(filters.promptLabel);
    if (filters.promptVersionId) match.promptVersionId = String(filters.promptVersionId);
    if (filters.feedbackTag) match["feedbackSummary.tags"] = String(filters.feedbackTag);
    if (filters.feedbackSentiment) {
        match["feedbackSummary.latestSentiment"] = String(filters.feedbackSentiment);
    }
    if (filters.minFeedbackScore || filters.maxFeedbackScore) {
        match["feedbackSummary.avgScore"] = {};
        const minFeedbackScore = Number(filters.minFeedbackScore);
        const maxFeedbackScore = Number(filters.maxFeedbackScore);
        const scoreRange = match["feedbackSummary.avgScore"] as Record<string, number>;
        if (Number.isFinite(minFeedbackScore)) {
            scoreRange.$gte = minFeedbackScore;
        }
        if (Number.isFinite(maxFeedbackScore)) {
            scoreRange.$lte = maxFeedbackScore;
        }
    }
    const latencyRange: Record<string, number> = {};
    const minLatency = Number(filters.minLatencyMs);
    const maxLatency = Number(filters.maxLatencyMs);
    if (Number.isFinite(minLatency)) latencyRange.$gte = minLatency;
    if (Number.isFinite(maxLatency)) latencyRange.$lte = maxLatency;
    if (Object.keys(latencyRange).length > 0) match.durationMs = latencyRange;

    const costRange: Record<string, number> = {};
    const minCost = Number(filters.minCost);
    const maxCost = Number(filters.maxCost);
    if (Number.isFinite(minCost)) costRange.$gte = minCost;
    if (Number.isFinite(maxCost)) costRange.$lte = maxCost;
    if (Object.keys(costRange).length > 0) match.totalCost = costRange;

    const startedAt: Record<string, Date> = {};
    const from = parseDate(filters.from);
    const to = parseDate(filters.to);
    if (from) startedAt.$gte = from;
    if (to) startedAt.$lte = to;
    if (Object.keys(startedAt).length > 0) match.startedAt = startedAt;

    const limit = Math.min(Math.max(parseInt(String(filters.limit || "50"), 10) || 50, 1), 100);
    const page = Math.max(parseInt(String(filters.page || "1"), 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [traces, total] = await Promise.all([
        AiTrace.find(match).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
        AiTrace.countDocuments(match),
    ]);

    return { traces: await attachPromptPreviews(scope, traces as unknown as TraceListRow[]), total, page, limit };
}

export async function getLatestTraces(scope: AiScope, limit = 5) {
    return AiTrace.find(buildScopeMatch(scope)).sort({ startedAt: -1 }).limit(limit).lean();
}
