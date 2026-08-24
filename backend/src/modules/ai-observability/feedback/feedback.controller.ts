import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import * as feedbackService from "../services/feedback.service";
import {
  reviewActorId,
  reviewScopeFrom,
  sendReviewError,
} from "../shared/review-controller-utils";

function numberQuery(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function feedbackPost(req: Request, res: Response) {
  try {
    const result = await feedbackService.submitFeedback(reviewScopeFrom(req), {
      ...req.body,
      actorId: reviewActorId(req),
    });
    return res.status(201).json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function feedbackGet(req: Request, res: Response) {
  try {
    const result = await feedbackService.listFeedback(reviewScopeFrom(req), {
      targetType:
        typeof req.query.targetType === "string"
          ? (req.query.targetType as feedbackService.FeedbackFilters["targetType"])
          : undefined,
      traceId: typeof req.query.traceId === "string" ? req.query.traceId : undefined,
      spanId: typeof req.query.spanId === "string" ? req.query.spanId : undefined,
      requestId: typeof req.query.requestId === "string" ? req.query.requestId : undefined,
      sentiment:
        typeof req.query.sentiment === "string"
          ? (req.query.sentiment as feedbackService.FeedbackFilters["sentiment"])
          : undefined,
      tag: typeof req.query.tag === "string" ? req.query.tag : undefined,
      page: numberQuery(req.query.page),
      limit: numberQuery(req.query.limit),
    });
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
