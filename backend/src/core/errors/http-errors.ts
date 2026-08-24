import { AppError } from "./app-error";

export function badRequest(
  message = "Bad Request",
  details?: unknown,
): AppError {
  return new AppError({
    code: "ERR_BAD_REQUEST",
    message,
    status: 400,
    details,
  });
}

export function unauthorized(
  message = "Unauthorized",
  details?: unknown,
): AppError {
  return new AppError({
    code: "ERR_UNAUTHORIZED",
    message,
    status: 401,
    details,
  });
}

export function forbidden(
  message = "Forbidden",
  details?: unknown,
): AppError {
  return new AppError({
    code: "ERR_FORBIDDEN",
    message,
    status: 403,
    details,
  });
}

export function notFound(message = "Not Found", details?: unknown): AppError {
  return new AppError({ code: "ERR_NOT_FOUND", message, status: 404, details });
}

export function internal(
  message = "Internal Server Error",
  details?: unknown,
): AppError {
  return new AppError({ code: "ERR_INTERNAL", message, status: 500, details });
}
