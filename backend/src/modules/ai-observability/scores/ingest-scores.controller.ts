import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import * as feedbackService from "../services/feedback.service";
import type { FeedbackScope } from "../services/feedback.service";
import { sendReviewError } from "../shared/review-controller-utils";

interface IngestContext {
  aiIngest?: { userId: string; tenantId?: string; workspaceId?: string };
}

function ingestScope(req: Request): FeedbackScope {
  const ingest = (req as Request & IngestContext).aiIngest;
  if (!ingest?.userId) {
    const error = new Error("Ingest authentication required");
    (error as { status?: number }).status = 401;
    throw error;
  }
  return {
    userId: ingest.userId,
    tenantId:
      ingest.tenantId ||
      (typeof req.headers["x-tenant-id"] === "string" ? req.headers["x-tenant-id"] : undefined),
    workspaceId:
      ingest.workspaceId ||
      (typeof req.headers["x-workspace-id"] === "string" ? req.headers["x-workspace-id"] : undefined),
  };
}

/**
 * Public score ingestion for SDK score helpers. Accepts a single score or a
 * `scores` array. Source defaults to "api".
 */
export async function ingestScoresPost(req: Request, res: Response) {
  try {
    const scope = ingestScope(req);
    const payloads: feedbackService.FeedbackInput[] = Array.isArray(req.body?.scores)
      ? req.body.scores
      : [req.body];

    const results = [];
    for (const payload of payloads) {
      if (!payload || typeof payload !== "object") continue;
      const result = await feedbackService.submitFeedback(scope, {
        ...payload,
        source: payload.source || "api",
        actorId: scope.userId,
      });
      results.push(result);
    }
    return res.status(201).json(ok({ count: results.length, results }));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
