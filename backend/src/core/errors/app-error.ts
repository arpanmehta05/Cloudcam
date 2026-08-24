import { ZodError } from "zod";

export type AppErrorCode =
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
  | "ERR_FACT_BUILD_TIMEOUT"
  | "ERR_ACTION_REQUIRES_APPROVAL"
  | "ERR_ACTION_SAFETY_BLOCKED"
  | "ERR_ACTION_EXECUTION_PARTIAL";

export interface AppErrorOptions {
  code: AppErrorCode;
  message: string;
  status?: number;
  retryable?: boolean;
  details?: unknown;
}

export class AppError extends Error {
  code: AppErrorCode;
  status: number;
  retryable: boolean;
  details?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status ?? 500;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

interface ErrorResponseBody {
  success: false;
  code: AppErrorCode;
  error: string;
  retryable: boolean;
  details?: unknown;
}

interface ErrorResponse {
  status: number;
  body: ErrorResponseBody;
}

const STATUS_CODE_MAP: Record<number, AppErrorCode> = {
  400: "ERR_BAD_REQUEST",
  401: "ERR_UNAUTHORIZED",
  403: "ERR_FORBIDDEN",
  404: "ERR_NOT_FOUND",
  429: "ERR_RATE_LIMITED",
};

function mapStatusToCode(status: number): AppErrorCode {
  return STATUS_CODE_MAP[status] || "ERR_INTERNAL";
}

export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        success: false,
        code: error.code,
        error: error.message,
        retryable: error.retryable,
        details: error.details,
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 502,
      body: {
        success: false,
        code: "ERR_AI_OUTPUT_SCHEMA_INVALID",
        error: "AI output failed schema validation",
        retryable: true,
        details: error.flatten(),
      },
    };
  }

  const maybeStatus = (error as { status?: number } | null)?.status;
  const status = typeof maybeStatus === "number" ? maybeStatus : 500;
  const message =
    (error as { message?: string } | null)?.message || "Internal Server Error";

  return {
    status,
    body: {
      success: false,
      code: mapStatusToCode(status),
      error: message,
      retryable: status >= 500 || status === 429,
    },
  };
}
