import { AiRequestLog } from "../../../models/ai-request-log.model";
import { estimateCost } from "../../../config/ai-pricing";

type Candidate = {
    model: string;
    reason: string;
    minConfidence: number;
};

const FALLBACKS: Record<string, Candidate[]> = {
    openai: [
        { model: "gpt-4o-mini", reason: "short or routine OpenAI traffic can usually run on GPT-4o mini", minConfidence: 0.68 },
        { model: "gpt-3.5-turbo", reason: "legacy low-value OpenAI traffic is cheaper on a small model", minConfidence: 0.58 },
    ],
    anthropic: [
        { model: "claude-3-5-haiku-20241022", reason: "Claude Haiku is a lower-cost fit for concise answers", minConfidence: 0.68 },
        { model: "claude-3-haiku-20240307", reason: "older low-complexity Claude traffic can use Haiku", minConfidence: 0.58 },
    ],
    gemini: [
        { model: "gemini-2.5-flash", reason: "Gemini Flash is a better fit for low-latency routine calls", minConfidence: 0.68 },
        { model: "gemini-2.5-flash-lite", reason: "Gemini Flash Lite is enough for tiny completions", minConfidence: 0.58 },
    ],
    bedrock: [
        { model: "anthropic.claude-3-5-haiku-20241022-v1:0", reason: "Bedrock Claude Haiku reduces cost for lightweight Claude workloads", minConfidence: 0.7 },
        { model: "amazon.titan-text-lite-v1", reason: "Titan Lite is a low-cost Bedrock target for extraction and simple classification", minConfidence: 0.55 },
        { model: "meta.llama3-1-8b-instruct-v1:0", reason: "Llama 8B is a cheaper Bedrock option for simple instruction following", minConfidence: 0.55 },
    ],
    custom: [],
};

const PREMIUM_PATTERNS = [
    "gpt-4",
    "o1",
    "o3",
    "opus",
    "sonnet",
    "gemini-2.5-pro",
    "gemini-3.1-pro",
    "mistral-large",
    "llama3-1-70b",
    "llama3-2-90b",
    "titan-text-premier",
];

export interface RoutingRecommendation {
    endpoint: string | null;
    currentModel: string;
    suggestedModel: string;
    provider: string;
    requestsAffected: number;
    avgCompletionTokens: number;
    avgPromptTokens: number;
    currentCost: number;
    estimatedCost: number;
    monthlySavings: number;
    confidence: number;
    ruleTriggered: string;
}

function isPremiumModel(model: string) {
    const lower = model.toLowerCase();
    return PREMIUM_PATTERNS.some((pattern) => lower.includes(pattern));
}

// Apps using Google's Gemini API report the provider as "google", but the
// FALLBACKS (and pricing) tables are keyed "gemini". Without normalizing, all
// Gemini traffic is silently skipped and never gets a routing recommendation.
function normalizeProvider(provider: string): string {
    const normalized = provider.toLowerCase().trim();
    return normalized === "google" ? "gemini" : normalized;
}

function pickCandidate(provider: string, currentModel: string, avgPromptTokens: number, avgCompletionTokens: number): Candidate | null {
    const candidates = FALLBACKS[provider] || [];
    const current = currentModel.toLowerCase();
    const candidate = candidates.find((item) => item.model.toLowerCase() !== current && !current.includes(item.model.toLowerCase()));
    if (!candidate) return null;

    if (provider === "bedrock" && avgPromptTokens < 250 && avgCompletionTokens < 120) {
        return candidates.find((item) => item.model === "amazon.titan-text-lite-v1") || candidate;
    }

    return candidate;
}

function confidenceFor(row: any, rangeDays: number, candidate: Candidate) {
    const avgDailyRequests = row.requests / Math.max(rangeDays, 1);
    let confidence = candidate.minConfidence;
    const reasons: string[] = [];

    if (isPremiumModel(row._id.model)) {
        confidence += 0.12;
        reasons.push("premium_model");
    }
    if (row.avgCompletionTokens <= 220) {
        confidence += 0.1;
        reasons.push("short_completion");
    }
    if (row.avgPromptTokens <= 700) {
        confidence += 0.08;
        reasons.push("compact_prompt");
    }
    if (avgDailyRequests >= 25) {
        confidence += 0.07;
        reasons.push("repeatable_traffic");
    }
    if ((row.errorCount || 0) / Math.max(row.requests, 1) > 0.1) {
        confidence -= 0.12;
        reasons.push("high_error_rate");
    }
    if ((row.avgLatency || 0) > 5000) {
        confidence += 0.05;
        reasons.push("latency_pressure");
    }

    return {
        confidence: Math.max(0.45, Math.min(0.95, Math.round(confidence * 100) / 100)),
        rule: reasons.length ? reasons.join("+") : "cost_optimization",
    };
}

export async function generateRoutingRecommendations(userId: string, rangeDays: number = 7): Promise<RoutingRecommendation[]> {
    const days = Math.min(Math.max(rangeDays, 1), 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const groups = await AiRequestLog.aggregate([
        { $match: { userId, createdAt: { $gte: cutoff }, status: "success" } },
        {
            $group: {
                _id: { endpoint: "$endpoint", model: "$modelName", provider: "$provider" },
                requests: { $sum: 1 },
                avgCompletionTokens: { $avg: "$completionTokens" },
                avgPromptTokens: { $avg: "$promptTokens" },
                totalPromptTokens: { $sum: "$promptTokens" },
                totalCompletionTokens: { $sum: "$completionTokens" },
                totalCost: { $sum: "$cost" },
                avgLatency: { $avg: "$latencyMs" },
                errorCount: { $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] } },
            },
        },
        { $match: { requests: { $gte: 3 }, totalCost: { $gt: 0 } } },
        { $sort: { totalCost: -1 } },
        { $limit: 50 },
    ]);

    const monthlyFactor = 30 / days;
    const recommendations: RoutingRecommendation[] = [];

    for (const row of groups as any[]) {
        const provider = normalizeProvider(row._id.provider);
        const currentModel = row._id.model;
        const candidate = pickCandidate(provider, currentModel, row.avgPromptTokens, row.avgCompletionTokens);
        if (!candidate) continue;

        const currentMonthly = row.totalCost * monthlyFactor;
        const estimate = estimateCost(provider, candidate.model, row.totalPromptTokens, row.totalCompletionTokens);
        const suggestedMonthly = (estimate.estimated ? estimate.cost : row.totalCost * 0.45) * monthlyFactor;
        const savings = currentMonthly - suggestedMonthly;
        if (savings <= 0.01) continue;

        const signal = confidenceFor(row, days, candidate);
        if (signal.confidence < 0.55 && savings < 5) continue;

        recommendations.push({
            endpoint: row._id.endpoint || null,
            currentModel,
            suggestedModel: candidate.model,
            provider,
            requestsAffected: row.requests,
            avgCompletionTokens: Math.round(row.avgCompletionTokens || 0),
            avgPromptTokens: Math.round(row.avgPromptTokens || 0),
            currentCost: Math.round(currentMonthly * 100) / 100,
            estimatedCost: Math.round(suggestedMonthly * 100) / 100,
            monthlySavings: Math.round(savings * 100) / 100,
            confidence: signal.confidence,
            ruleTriggered: `${signal.rule}: ${candidate.reason}`,
        });
    }

    return recommendations.sort((a, b) => b.monthlySavings - a.monthlySavings).slice(0, 12);
}
