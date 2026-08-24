import { Request, Response } from "express";
import {
  hasExplicitEnvironment,
  resolveAiScope,
} from "../../../services/ai-scope.service";
import { sendReviewError } from "../shared/review-controller-utils";
import * as traceDetailService from "./trace-detail.service";

interface AuthRequest extends Request {
  user?: { userId: string };
}

export async function traceDetailGet(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).user?.userId;
    if (!userId)
      throw Object.assign(new Error("Authentication required"), { status: 401 });
    const scope = await resolveAiScope(req, userId);
    if (!hasExplicitEnvironment(req)) {
      scope.environment = undefined;
    }
    const traceId = Array.isArray(req.params.traceId)
      ? req.params.traceId[0]
      : req.params.traceId;
    const detail = await traceDetailService.getTraceDetail(scope, traceId);

    if (!detail) {
      return res.status(404).json({ success: false, error: "Trace not found" });
    }

    return res.json({ success: true, ...detail });
  } catch (error) {
    return sendReviewError(res, error);
  }
}
