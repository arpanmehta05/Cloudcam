import { Request, Response } from "express";
import { toErrorResponse } from "../../../core/errors";
import type { FeedbackScope } from "../services/feedback.service";

interface RequestContext {
  user?: { userId: string };
}

export function reviewScopeFrom(req: Request): FeedbackScope {
  const userId = (req as Request & RequestContext).user?.userId;
  if (!userId) {
    const error = new Error("Authentication required");
    (error as { status?: number }).status = 401;
    throw error;
  }
  return {
    userId,
    tenantId:
      typeof req.headers["x-tenant-id"] === "string"
        ? req.headers["x-tenant-id"]
        : undefined,
    workspaceId:
      typeof req.headers["x-workspace-id"] === "string"
        ? req.headers["x-workspace-id"]
        : undefined,
  };
}

export function reviewActorId(req: Request): string {
  return (req as Request & RequestContext).user?.userId || "system";
}

export function sendReviewError(res: Response, error: unknown) {
  const response = toErrorResponse(error);
  return res.status(response.status).json(response.body);
}
