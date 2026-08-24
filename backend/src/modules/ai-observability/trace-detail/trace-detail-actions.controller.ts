import { Request, Response } from "express";
import { resolveAiScope } from "../../../services/ai-scope.service";
import { ok } from "../../../shared/responses";
import { sendReviewError } from "../shared/review-controller-utils";
import * as traceDetailService from "./trace-detail.service";

interface AuthRequest extends Request {
  user?: { userId: string };
}

function hasExplicitEnvironment(req: Request): boolean {
  return (
    typeof req.headers["x-environment"] === "string" ||
    typeof req.query.environment === "string"
  );
}

async function scopeFrom(req: Request) {
  const userId = (req as AuthRequest).user?.userId;
  if (!userId) throw Object.assign(new Error("Authentication required"), { status: 401 });
  const scope = await resolveAiScope(req, userId);
  if (!hasExplicitEnvironment(req)) scope.environment = undefined;
  return scope;
}

export async function traceScoresGet(req: Request, res: Response) {
  try {
    return res.json(ok(await traceDetailService.getTraceScores(await scopeFrom(req), String(req.params.traceId))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
