import { Request, Response } from "express";
import { resolveAiScope, hasExplicitEnvironment } from "../services/scope.service";
import { ok } from "../../../shared/responses";
import { sendReviewError } from "../shared/review-controller-utils";
import * as sessionsService from "./sessions.service";

interface AuthRequest extends Request {
  user?: { userId: string };
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

async function scoped(req: Request) {
  const userId = (req as AuthRequest).user?.userId;
  if (!userId) throw Object.assign(new Error("Authentication required"), { status: 401 });
  const scope = await resolveAiScope(req, userId);
  if (!hasExplicitEnvironment(req)) scope.environment = undefined;
  return scope;
}

export async function sessionsGet(req: Request, res: Response) {
  try {
    return res.json(ok(await sessionsService.listSessions(await scoped(req))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}

export async function sessionDetailGet(req: Request, res: Response) {
  try {
    return res.json(ok(await sessionsService.getSessionDetail(await scoped(req), param(req.params.sessionId))));
  } catch (error) {
    return sendReviewError(res, error);
  }
}
