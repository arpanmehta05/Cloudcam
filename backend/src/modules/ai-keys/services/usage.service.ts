import { User, decryptKey } from "../../../models/user.model";
import { getOpenAIUsageLogs, getOpenAIPerKeyUsage } from "./usage/aggregator";

export { getOpenAIUsageLogs, getOpenAIPerKeyUsage };

export const OPENAI_BASE = "https://api.openai.com/v1";
const EXTERNAL_API_TIMEOUT_MS = 25000;

interface OpenAIBucket {
    object: string;
    start_time: number;
    end_time: number;
    results: Record<string, any>[];
}

interface OpenAIPageResponse {
    object: string;
    data: OpenAIBucket[];
    has_more: boolean;
    next_page: string | null;
}

export function withTimeout(init?: RequestInit): RequestInit {
    return {
        ...init,
        signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
    };
}

export async function openaiGet(path: string, apiKey: string, params: Record<string, string | string[]>): Promise<OpenAIPageResponse> {
    const url = new URL(`${OPENAI_BASE}${path}`);
    for (const [key, val] of Object.entries(params)) {
        if (Array.isArray(val)) {
            val.forEach(v => url.searchParams.append(key, v));
        } else {
            url.searchParams.set(key, val);
        }
    }
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        ...withTimeout(),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI API ${res.status}: ${body}`);
    }
    return res.json() as Promise<OpenAIPageResponse>;
}

export async function getOpenAIUsage(userId: string, days: number = 30) {
    const user = await User.findById(userId);
    if (!user?.aiApiKeys?.openai?.apiKey) throw new Error("OpenAI API key not configured");

    const apiKey = decryptKey(user.aiApiKeys.openai.apiKey);
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - days * 86400;
    const bucketWidth = days <= 2 ? "1h" : "1d";

    const params: Record<string, string | string[]> = {
        start_time: String(startTime),
        end_time: String(now),
        bucket_width: bucketWidth,
        group_by: ["model"],
        limit: String(days <= 2 ? 48 : Math.min(days, 31)),
    };

    const paramsNoGroup: Record<string, string | string[]> = { ...params };
    delete paramsNoGroup.group_by;

    const errors: string[] = [];

    const tryCall = async (path: string, p: Record<string, string | string[]>) => {
        try {
            return await openaiGet(path, apiKey, p);
        } catch (e: any) {
            const msg = String(e.message || e).slice(0, 200);
            errors.push(`${path}: ${msg}`);
            return null;
        }
    };

    const [completions, costs, embeddings, images] = await Promise.all([
        tryCall("/organization/usage/completions", params)
            .then(r => r ?? tryCall("/organization/usage/completions", paramsNoGroup)),
        tryCall("/organization/costs", {
            start_time: String(startTime),
            end_time: String(now),
            bucket_width: "1d",
            group_by: ["line_item"],
            limit: String(Math.min(days, 31)),
        }),
        tryCall("/organization/usage/embeddings", params)
            .then(r => r ?? tryCall("/organization/usage/embeddings", paramsNoGroup)),
        tryCall("/organization/usage/images", paramsNoGroup),
    ]);

    return { completions, costs, embeddings, images, errors: errors.length ? errors : undefined };
}

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

export async function validateAnthropicKey(apiKey: string): Promise<{ valid: boolean; models?: string[] }> {
    try {
        const res = await fetch(`${ANTHROPIC_BASE}/models`, {
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            ...withTimeout(),
        });
        if (!res.ok) return { valid: false };
        const data = await res.json() as any;
        const models = data.data?.map((m: any) => m.id) || [];
        return { valid: true, models };
    } catch {
        return { valid: false };
    }
}

export async function validateOpenAIKey(apiKey: string): Promise<{ valid: boolean; models?: string[] }> {
    if (apiKey.startsWith("sk-admin-")) {
        return { valid: true, models: [] };
    }
    try {
        const res = await fetch(`${OPENAI_BASE}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            ...withTimeout(),
        });
        if (!res.ok) return { valid: false };
        const data = await res.json() as any;
        const models = data.data?.map((m: any) => m.id).slice(0, 20) || [];
        return { valid: true, models };
    } catch {
        return { valid: false };
    }
}

export const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
    "claude-opus-4-6": { input: 5, output: 25 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5": { input: 1, output: 5 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
    "claude-3-5-haiku-20241022": { input: 1, output: 5 },
    "claude-3-opus-20240229": { input: 15, output: 75 },
    "claude-3-sonnet-20240229": { input: 3, output: 15 },
    "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
};

export const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-4": { input: 30, output: 60 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    "o1": { input: 15, output: 60 },
    "o1-mini": { input: 3, output: 12 },
    "o3-mini": { input: 1.1, output: 4.4 },
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function validateGeminiKey(apiKey: string): Promise<{ valid: boolean; models?: string[] }> {
    try {
        const res = await fetch(
            `${GEMINI_BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=50`,
            withTimeout()
        );
        if (!res.ok) return { valid: false };
        const data = await res.json() as any;
        const models = (data.models || [])
            .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
            .map((m: any) => m.name?.replace("models/", "") || m.baseModelId)
            .slice(0, 30);
        return { valid: true, models };
    } catch {
        return { valid: false };
    }
}

export const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
    "gemini-2.5-pro": { input: 1.25, output: 10 },
    "gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
    "gemini-2.0-flash": { input: 0.1, output: 0.4 },
    "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
    "gemini-3.1-pro-preview": { input: 2, output: 12 },
    "gemini-3-flash-preview": { input: 0.5, output: 3 },
    "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.5 },
};
