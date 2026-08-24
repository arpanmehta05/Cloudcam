import { Request, Response } from "express";
import * as promptInsightsService from "./prompt-insights.service";

// GET /api/ai-observability/recommendations/prompts
export async function promptInsightsGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const rangeDays = parseInt(String(req.query.rangeDays || "7"), 10);
    const insights = await promptInsightsService.generatePromptInsights(
      userId,
      Number.isFinite(rangeDays) ? rangeDays : 7,
    );
    return res.json({ success: true, insights });
  } catch (error) {
    console.error("ai-observability promptInsightsGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch prompt insights" });
  }
}
