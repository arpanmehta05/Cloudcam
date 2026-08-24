import { User, decryptKey } from "../../../../models/user.model";
import { openaiGet, OPENAI_BASE, withTimeout } from "../usage.service";

export async function getOpenAIUsageLogs(userId: string, days: number = 7) {
    const user = await User.findById(userId);
    if (!user?.aiApiKeys?.openai?.apiKey) throw new Error("OpenAI API key not configured");

    const apiKey = decryptKey(user.aiApiKeys.openai.apiKey);
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - days * 86400;

    const errors: string[] = [];
    const tryCall = async (path: string, p: Record<string, string | string[]>) => {
        try {
            return await openaiGet(path, apiKey, p);
        } catch (e: any) {
            errors.push(`${path}: ${String(e.message || e).slice(0, 200)}`);
            return null;
        }
    };

    const maxBuckets = Math.min(days * 24, 168);
    const completionsHourly = await tryCall("/organization/usage/completions", {
        start_time: String(startTime),
        end_time: String(now),
        bucket_width: "1h",
        group_by: ["model"],
        limit: String(maxBuckets),
    });
    const completionsFinal = completionsHourly
        ?? await tryCall("/organization/usage/completions", {
            start_time: String(startTime),
            end_time: String(now),
            bucket_width: "1h",
            limit: String(maxBuckets),
        });

    const usageLogs: Array<{
        timestamp: number;
        endTime: number;
        model: string;
        inputTokens: number;
        outputTokens: number;
        cachedTokens: number;
        requests: number;
    }> = [];

    completionsFinal?.data?.forEach((bucket: any) => {
        (bucket.results || []).forEach((r: any) => {
            const input = r.input_tokens || 0;
            const output = r.output_tokens || 0;
            const cached = r.input_cached_tokens || 0;
            const reqs = r.num_model_requests || 0;
            if (input + output + reqs === 0) return;
            usageLogs.push({
                timestamp: bucket.start_time,
                endTime: bucket.end_time,
                model: r.model || "unknown",
                inputTokens: input,
                outputTokens: output,
                cachedTokens: cached,
                requests: reqs,
            });
        });
    });

    usageLogs.sort((a, b) => b.timestamp - a.timestamp || a.model.localeCompare(b.model));

    let auditLogs: any[] = [];
    try {
        const auditUrl = new URL(`${OPENAI_BASE}/organization/audit_logs`);
        auditUrl.searchParams.set("limit", "50");
        const auditRes = await fetch(auditUrl.toString(), {
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            ...withTimeout(),
        });
        if (auditRes.ok) {
            const auditData = await auditRes.json() as any;
            auditLogs = (auditData.data || []).map((log: any) => ({
                id: log.id,
                type: log.type,
                timestamp: log.effective_at,
                actor: log.actor?.type === "session"
                    ? log.actor.session?.user?.email
                    : log.actor?.type === "api_key"
                        ? log.actor.api_key?.user?.email || "API Key"
                        : log.actor?.type || "system",
            }));
        } else {
            errors.push(`/organization/audit_logs: ${auditRes.status}`);
        }
    } catch (e: any) {
        errors.push(`/organization/audit_logs: ${String(e.message || e).slice(0, 200)}`);
    }

    return { usageLogs, auditLogs, errors: errors.length ? errors : undefined };
}

export async function getOpenAIPerKeyUsage(userId: string, days: number = 30) {
    const user = await User.findById(userId);
    if (!user?.aiApiKeys?.openai?.apiKey) throw new Error("OpenAI API key not configured");

    const apiKey = decryptKey(user.aiApiKeys.openai.apiKey);
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - days * 86400;

    const errors: string[] = [];
    const tryCall = async (path: string, p: Record<string, string | string[]>) => {
        try {
            return await openaiGet(path, apiKey, p);
        } catch (e: any) {
            errors.push(`${path}: ${String(e.message || e).slice(0, 200)}`);
            return null;
        }
    };

    const limit = String(Math.min(days, 31));

    const fetchKeyNames = async (): Promise<Record<string, string>> => {
        try {
            const res = await fetch(`${OPENAI_BASE}/organization/api_keys?limit=100`, {
                headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
                ...withTimeout(),
            });
            if (!res.ok) return {};
            const body = await res.json() as any;
            const map: Record<string, string> = {};
            (body?.data || []).forEach((k: any) => { if (k.id && k.name) map[k.id] = k.name; });
            return map;
        } catch { return {}; }
    };

    const [completionsByKey, completionsByUser, completionsByProject, embeddingsByKey, costsByProject, keyNameMap] = await Promise.all([
        tryCall("/organization/usage/completions", {
            start_time: String(startTime), end_time: String(now),
            bucket_width: "1d", group_by: ["api_key_id", "model"], limit,
        }),
        tryCall("/organization/usage/completions", {
            start_time: String(startTime), end_time: String(now),
            bucket_width: "1d", group_by: ["user_id", "model"], limit,
        }),
        tryCall("/organization/usage/completions", {
            start_time: String(startTime), end_time: String(now),
            bucket_width: "1d", group_by: ["project_id"], limit,
        }),
        tryCall("/organization/usage/embeddings", {
            start_time: String(startTime), end_time: String(now),
            bucket_width: "1d", group_by: ["api_key_id", "model"], limit,
        }),
        tryCall("/organization/costs", {
            start_time: String(startTime), end_time: String(now),
            bucket_width: "1d", group_by: ["project_id", "line_item"], limit,
        }),
        fetchKeyNames(),
    ]);

    const keyBreakdown: Record<string, {
        apiKeyId: string; apiKeyName: string; models: Record<string, { input: number; output: number; cached: number; requests: number }>;
        totalInput: number; totalOutput: number; totalCached: number; totalRequests: number;
    }> = {};

    completionsByKey?.data?.forEach((bucket: any) => {
        (bucket.results || []).forEach((r: any) => {
            const keyId = r.api_key_id || "unknown";
            if (!keyBreakdown[keyId]) {
                keyBreakdown[keyId] = { apiKeyId: keyId, apiKeyName: keyNameMap[keyId] || keyId, models: {}, totalInput: 0, totalOutput: 0, totalCached: 0, totalRequests: 0 };
            }
            const entry = keyBreakdown[keyId];
            const model = r.model || "unknown";
            if (!entry.models[model]) entry.models[model] = { input: 0, output: 0, cached: 0, requests: 0 };
            entry.models[model].input += r.input_tokens || 0;
            entry.models[model].output += r.output_tokens || 0;
            entry.models[model].cached += r.input_cached_tokens || 0;
            entry.models[model].requests += r.num_model_requests || 0;
            entry.totalInput += r.input_tokens || 0;
            entry.totalOutput += r.output_tokens || 0;
            entry.totalCached += r.input_cached_tokens || 0;
            entry.totalRequests += r.num_model_requests || 0;
        });
    });

    const userBreakdown: Record<string, { userId: string; totalInput: number; totalOutput: number; totalRequests: number; models: string[] }> = {};
    completionsByUser?.data?.forEach((bucket: any) => {
        (bucket.results || []).forEach((r: any) => {
            const uid = r.user_id || "unknown";
            if (!userBreakdown[uid]) userBreakdown[uid] = { userId: uid, totalInput: 0, totalOutput: 0, totalRequests: 0, models: [] };
            userBreakdown[uid].totalInput += r.input_tokens || 0;
            userBreakdown[uid].totalOutput += r.output_tokens || 0;
            userBreakdown[uid].totalRequests += r.num_model_requests || 0;
            const model = r.model || "unknown";
            if (!userBreakdown[uid].models.includes(model)) userBreakdown[uid].models.push(model);
        });
    });

    const projectBreakdown: Record<string, { projectId: string; totalInput: number; totalOutput: number; totalRequests: number }> = {};
    completionsByProject?.data?.forEach((bucket: any) => {
        (bucket.results || []).forEach((r: any) => {
            const pid = r.project_id || "default";
            if (!projectBreakdown[pid]) projectBreakdown[pid] = { projectId: pid, totalInput: 0, totalOutput: 0, totalRequests: 0 };
            projectBreakdown[pid].totalInput += r.input_tokens || 0;
            projectBreakdown[pid].totalOutput += r.output_tokens || 0;
            projectBreakdown[pid].totalRequests += r.num_model_requests || 0;
        });
    });

    const embeddingKeyBreakdown: Record<string, { apiKeyId: string; apiKeyName: string; totalTokens: number; totalRequests: number; models: string[] }> = {};
    embeddingsByKey?.data?.forEach((bucket: any) => {
        (bucket.results || []).forEach((r: any) => {
            const keyId = r.api_key_id || "unknown";
            if (!embeddingKeyBreakdown[keyId]) embeddingKeyBreakdown[keyId] = { apiKeyId: keyId, apiKeyName: keyNameMap[keyId] || keyId, totalTokens: 0, totalRequests: 0, models: [] };
            embeddingKeyBreakdown[keyId].totalTokens += r.input_tokens || 0;
            embeddingKeyBreakdown[keyId].totalRequests += r.num_model_requests || 0;
            const model = r.model || "unknown";
            if (!embeddingKeyBreakdown[keyId].models.includes(model)) embeddingKeyBreakdown[keyId].models.push(model);
        });
    });

    const projectCosts: Record<string, { projectId: string; totalCost: number; lineItems: Record<string, number> }> = {};
    costsByProject?.data?.forEach((bucket: any) => {
        (bucket.results || []).forEach((r: any) => {
            const pid = r.project_id || "default";
            if (!projectCosts[pid]) projectCosts[pid] = { projectId: pid, totalCost: 0, lineItems: {} };
            const val = r.amount?.value || 0;
            projectCosts[pid].totalCost += val;
            const item = r.line_item || "other";
            projectCosts[pid].lineItems[item] = (projectCosts[pid].lineItems[item] || 0) + val;
        });
    });

    return {
        byApiKey: Object.values(keyBreakdown).sort((a, b) => (b.totalInput + b.totalOutput) - (a.totalInput + a.totalOutput)),
        byUser: Object.values(userBreakdown).sort((a, b) => (b.totalInput + b.totalOutput) - (a.totalInput + a.totalOutput)),
        byProject: Object.values(projectBreakdown).sort((a, b) => (b.totalInput + b.totalOutput) - (a.totalInput + a.totalOutput)),
        embeddingsByKey: Object.values(embeddingKeyBreakdown).sort((a, b) => b.totalTokens - a.totalTokens),
        projectCosts: Object.values(projectCosts).sort((a, b) => b.totalCost - a.totalCost),
        errors: errors.length ? errors : undefined,
    };
}
