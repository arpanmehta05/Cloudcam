import { Request, Response } from "express";
import { ok } from "../../../shared/responses";
import { hasExplicitEnvironment, resolveAiScope } from "../services/scope.service";
import * as observationQueryService from "../services/observation-query.service";
import { sendReviewError } from "../shared/review-controller-utils";

interface AuthRequest extends Request {
  user?: { userId: string };
}

async function scoped(req: Request) {
  const userId = (req as AuthRequest).user?.userId;
  if (!userId) throw Object.assign(new Error("Authentication required"), { status: 401 });
  const scope = await resolveAiScope(req, userId);
  if (!hasExplicitEnvironment(req)) scope.environment = undefined;
  return scope;
}

export async function observationsGet(req: Request, res: Response) {
  try {
    const result = await observationQueryService.listObservations(await scoped(req), req.query);
    return res.json(ok(result));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
