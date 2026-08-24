import { Request, Response } from "express";
import * as overviewService from "../services/overview.service";
import {
  hasExplicitEnvironment,
  resolveAiScope,
} from "../services/scope.service";

export async function overviewGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const scope = await resolveAiScope(req, userId);
    if (!hasExplicitEnvironment(req)) {
      scope.environment = undefined;
    }
    const provider =
      typeof req.query.provider === "string" ? req.query.provider : undefined;
    const range =
      typeof req.query.range === "string" ? req.query.range : undefined;
    const overview = await overviewService.getOverview(scope, provider, range);
    return res.json({ success: true, overview });
  } catch (error) {
    console.error("ai-observability overviewGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch overview" });
  }
}
