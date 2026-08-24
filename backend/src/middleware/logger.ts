import { logger } from "../core/logger";
// Request Logger Middleware
import { Request, Response, NextFunction } from "express";

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

function statusColor(status: number): string {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  return colors.green;
}

function methodColor(method: string): string {
  switch (method) {
    case "GET":
      return colors.green;
    case "POST":
      return colors.magenta;
    case "PUT":
      return colors.yellow;
    case "DELETE":
      return colors.red;
    default:
      return colors.white;
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const path = req.originalUrl || req.url;

    // Extract userId from JWT if available
    const userId = (req as any).user?.userId;
    const userTag = userId
      ? ` ${colors.dim}[user:${userId.slice(-6)}]${colors.reset}`
      : "";

    const line = [
      `${colors.dim}${timestamp}${colors.reset}`,
      `${methodColor(method)}${method.padEnd(6)}${colors.reset}`,
      `${statusColor(status)}${status}${colors.reset}`,
      path,
      `${colors.dim}${duration}ms${colors.reset}`,
      userTag,
    ].join(" ");

    logger.info(line);

    // Log slow requests
    if (duration > 3000) {
      logger.info(
        `  ${colors.yellow}⚠ Slow request: ${duration}ms${colors.reset}`,
      );
    }
  });

  next();
}
