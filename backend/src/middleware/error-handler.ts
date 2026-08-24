// Middleware: Global error handler
import { Request, Response, NextFunction, RequestHandler } from "express";

// Wraps async handlers so rejected promises forward to Express's error handler
// instead of becoming unhandled rejections that bypass our JSON error response.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error(
    `[Error] ${req.method} ${req.path}:`,
    err?.stack || err?.message || err,
  );

  if (res.headersSent) {
    console.error(
      `[Error] Response already sent for ${req.method} ${req.path}, cannot send error JSON`,
    );
    return;
  }

  if (err?.message === "AWS_NOT_CONNECTED") {
    return res.status(403).json({
      success: false,
      notConnected: true,
      error: "AWS account not connected. Complete the setup at /settings/aws.",
    });
  }

  if (err?.message?.startsWith?.("AWS_ASSUME_ROLE_DENIED")) {
    return res.status(403).json({
      success: false,
      notConnected: true,
      error:
        "AWS role assumption failed. Reconnect in /settings/aws and use Update Stack to Latest to refresh the ExternalId and trust policy.",
    });
  }

  const status =
    typeof err?.status === "number" && err.status >= 400 && err.status < 600
      ? err.status
      : 500;
  res.status(status).json({
    success: false,
    code: err?.code || "ERR_INTERNAL",
    error: err?.message || "Internal Server Error",
    retryable: err?.retryable ?? (status >= 500 || status === 429),
  });
}

export function isNotConnectedError(error: any): boolean {
  return (
    error?.message === "AWS_NOT_CONNECTED" ||
    error?.message?.startsWith("AWS_ASSUME_ROLE_DENIED")
  );
}

export function notConnectedResponse(res: Response, error?: any) {
  const assumeRoleDenied = error?.message?.startsWith("AWS_ASSUME_ROLE_DENIED");
  return res.status(403).json({
    success: false,
    notConnected: true,
    error: assumeRoleDenied
      ? "AWS role assumption failed. Reconnect in /settings/aws and use Update Stack to Latest to refresh the ExternalId and trust policy."
      : "AWS account not connected. Complete the setup at /settings/aws.",
  });
}
