import { CloudProvider } from "../../../models/aws.model";
import { config } from "../../../core/config";
import { recordProviderSync } from "../../../store/workspace-credentials";

const SECRET_PATTERNS = [
    /client_secret=[^&\s]+/gi,
    /private_key[^,\n}]*/gi,
    /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g,
    /arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]+/g,
];

export function sanitizeProviderError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error || "Unknown provider error");
    let message = raw.slice(0, 500);
    for (const pattern of SECRET_PATTERNS) {
        message = message.replace(pattern, "[redacted]");
    }
    if (/\b429\b|rate.?limit|too many requests|quota/i.test(message)) {
        return `Provider rate limit reached. Retry later or reduce refresh frequency. ${message}`;
    }
    return message;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, provider: CloudProvider, source: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${provider} ${source} timed out after ${Math.round(ms / 1000)}s`));
        }, ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function isRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || "");
    return /\b429\b|rate.?limit|too many requests|quota/i.test(message);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWithSingleBackoff<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (!isRateLimitError(error)) throw error;
        await sleep(1000);
        return operation();
    }
}

export async function withProviderSync<T>(
    userId: string,
    provider: CloudProvider,
    source: string,
    operation: () => Promise<T>
): Promise<T> {
    await recordProviderSync(userId, provider, "syncing", source).catch(() => undefined);
    try {
        const syncTimeout = Math.min(config.providerSyncTimeoutMs, 15000);
        const result = await withTimeout(runWithSingleBackoff(operation), syncTimeout, provider, source);
        const warnings = Array.isArray((result as any)?.warnings) ? (result as any).warnings : [];
        await recordProviderSync(userId, provider, warnings.length > 0 ? "partial" : "ok", source).catch(() => undefined);
        return result as T;
    } catch (error) {
        const message = sanitizeProviderError(error);
        await recordProviderSync(userId, provider, "error", source, message).catch(() => undefined);
        throw new Error(message);
    }
}
