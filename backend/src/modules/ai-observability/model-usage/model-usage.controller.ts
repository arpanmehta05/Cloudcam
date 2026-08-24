import { Request, Response } from "express";
import { hasExplicitEnvironment, resolveAiScope } from "../services/scope.service";
import * as modelUsageService from "./model-usage.service";

export async function modelsGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const scope = await resolveAiScope(req, userId);
    if (!hasExplicitEnvironment(req)) {
      scope.environment = undefined;
    }
    const range = req.query.range as string;
    const provider =
      typeof req.query.provider === "string" ? req.query.provider : undefined;
    const models = await modelUsageService.getModelPerformance(
      scope,
      range,
      provider,
    );
    return res.json({ success: true, models });
  } catch (error) {
    console.error("ai-observability modelsGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch model performance" });
  }
}
