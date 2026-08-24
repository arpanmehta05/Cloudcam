// Auth-aware fetch utility
import { z } from "zod";
import { clearRouteDataCache, clearRouteDataCacheAfterMutation, routeDataCachedFetch } from "./route-data-cache";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL
    || (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "");

export type ApiErrorCode =
    | "ERR_BAD_REQUEST"
    | "ERR_UNAUTHORIZED"
    | "ERR_FORBIDDEN"
    | "ERR_NOT_FOUND"
    | "ERR_RATE_LIMITED"
    | "ERR_INTERNAL"
    | "ERR_AI_PROVIDER_NOT_CONFIGURED"
    | "ERR_AI_RATE_LIMITED"
    | "ERR_AI_UPSTREAM_FAILED"
    | "ERR_AI_OUTPUT_INVALID_JSON"
    | "ERR_AI_OUTPUT_SCHEMA_INVALID"
    | "ERR_RESPONSE_SCHEMA_INVALID"
    | "ERR_RESPONSE_NOT_JSON";

export class ApiClientError extends Error {
    code: ApiErrorCode;
    status: number;
    retryable: boolean;
    details?: unknown;
    notConnected: boolean;

    constructor(params: {
        message: string;
        code: ApiErrorCode;
        status: number;
        retryable?: boolean;
        details?: unknown;
        notConnected?: boolean;
    }) {
        super(params.message);
        this.name = "ApiClientError";
        this.code = params.code;
        this.status = params.status;
        this.retryable = params.retryable ?? (params.status >= 500 || params.status === 429);
        this.details = params.details;
        this.notConnected = params.notConnected ?? false;
    }
}

const ApiEnvelopeSchema = z.object({
    success: z.boolean().optional(),
    code: z.string().optional(),
    error: z.union([z.string(), z.boolean()]).optional(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
    retryable: z.boolean().optional(),
    notConnected: z.boolean().optional(),
}).passthrough();

const AnyObjectSchema = z.object({}).passthrough();

function mapStatusToCode(status: number): ApiErrorCode {
    if (status === 400) return "ERR_BAD_REQUEST";
    if (status === 401) return "ERR_UNAUTHORIZED";
    if (status === 403) return "ERR_FORBIDDEN";
    if (status === 404) return "ERR_NOT_FOUND";
    if (status === 429) return "ERR_RATE_LIMITED";
    return "ERR_INTERNAL";
}

async function parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) {
        if (!response.ok) {
            return {
                success: false,
                error: response.statusText || "Request failed",
                details: { preview: text.slice(0, 300) },
            };
        }

        throw new ApiClientError({
            message: "Received HTML instead of JSON response. Check API route/rewrite configuration.",
            code: "ERR_RESPONSE_NOT_JSON",
            status: response.status || 500,
            retryable: response.status >= 500,
            details: {
                url: response.url,
                contentType,
                preview: text.slice(0, 300),
            },
        });
    }

    try {
        return JSON.parse(text);
    } catch {
        if (!response.ok) {
            return {
                success: false,
                error: text || response.statusText || "Request failed",
            };
        }

        throw new ApiClientError({
            message: `Invalid JSON (Status ${response.status}): ${text.slice(0, 100) || "Empty body"}`,
            code: "ERR_RESPONSE_NOT_JSON",
            status: response.status || 500,
            retryable: response.status >= 500,
            details: {
                url: response.url,
                contentType,
                preview: text.slice(0, 300),
            },
        });
    }
}

function getRequestMethod(options?: RequestInit): string {
    return (options?.method || "GET").toUpperCase();
}

export const clearApiCache = clearRouteDataCache;

function applyAuthJsonParser(response: Response): Response {
    response.json = async () => {
        const raw = await parseResponseBody(response);

        const envelope = ApiEnvelopeSchema.safeParse(raw);
        if (!envelope.success) {
            throw new ApiClientError({
                message: "Response failed base schema validation",
                code: "ERR_RESPONSE_SCHEMA_INVALID",
                status: response.status || 500,
                details: envelope.error.flatten(),
            });
        }

        const payload = envelope.data;
        if (!response.ok || payload.success === false) {
            const fallbackCode = mapStatusToCode(response.status || 500);
            const errorMessage = typeof payload.error === "string" ? payload.error : undefined;
            throw new ApiClientError({
                message: errorMessage || response.statusText || "Request failed",
                code: (payload.code as ApiErrorCode | undefined) || fallbackCode,
                status: response.status || 500,
                retryable: payload.retryable,
                details: payload.details ?? (payload.requestId ? { requestId: payload.requestId } : undefined),
                notConnected: !!payload.notConnected,
            });
        }

        const objectParsed = AnyObjectSchema.safeParse(raw);
        if (!objectParsed.success) {
            throw new ApiClientError({
                message: "Response failed JSON object schema validation",
                code: "ERR_RESPONSE_SCHEMA_INVALID",
                status: response.status || 500,
                details: objectParsed.error.flatten(),
            });
        }

        return objectParsed.data;
    };

    return response;
}

export async function parseApiResponse<T extends Record<string, any> = Record<string, any>>(
    response: Response,
    schema?: z.ZodType<T>
): Promise<T> {
    const raw = await parseResponseBody(response);

    const envelope = ApiEnvelopeSchema.safeParse(raw);
    if (!envelope.success) {
        throw new ApiClientError({
            message: "Response failed base schema validation",
            code: "ERR_RESPONSE_SCHEMA_INVALID",
            status: response.status || 500,
            details: envelope.error.flatten(),
        });
    }

    const payload = envelope.data;

    if (!response.ok || payload.success === false) {
        const fallbackCode = mapStatusToCode(response.status || 500);
        const errorMessage = typeof payload.error === "string" ? payload.error : undefined;
        throw new ApiClientError({
            message: errorMessage || response.statusText || "Request failed",
            code: (payload.code as ApiErrorCode | undefined) || fallbackCode,
            status: response.status || 500,
            retryable: payload.retryable,
            details: payload.details ?? (payload.requestId ? { requestId: payload.requestId } : undefined),
            notConnected: !!payload.notConnected,
        });
    }

    const targetSchema = (schema || (AnyObjectSchema as unknown as z.ZodType<T>));
    const parsed = targetSchema.safeParse(raw);
    if (!parsed.success) {
        throw new ApiClientError({
            message: "Response failed endpoint schema validation",
            code: "ERR_RESPONSE_SCHEMA_INVALID",
            status: response.status || 500,
            details: parsed.error.flatten(),
        });
    }

    return parsed.data;
}

export function authFetch(url: string, options?: RequestInit): Promise<Response> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        ...(options?.headers as Record<string, string> || {}),
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    if (options?.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    // Resolve full URL: prepend API base for relative /api/* paths
    const resolvedUrl = buildApiUrl(url);
    const method = getRequestMethod(options);
    const cachedRouteData = routeDataCachedFetch(resolvedUrl, options, headers);
    if (cachedRouteData) return cachedRouteData.then(applyAuthJsonParser);

    return fetch(resolvedUrl, { ...options, headers, cache: options?.cache || "no-store" }).then((response) => {
        clearRouteDataCacheAfterMutation(method);
        return applyAuthJsonParser(response);
    });
}

export function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("rabbittize_token")?.trim();
    return token || null;
}

export function buildApiUrl(path: string): string {
    return API_BASE && path.startsWith("/api/") ? `${API_BASE}${path}` : path;
}

export async function authFetchJson<T extends Record<string, any> = Record<string, any>>(
    url: string,
    schema?: z.ZodType<T>,
    options?: RequestInit
): Promise<T> {
    const response = await authFetch(url, options);
    return parseApiResponse(response, schema);
}
