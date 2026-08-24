import { Request, Response } from "express";
import * as routingService from "./routing-recommendations.service";

// GET /api/ai-observability/recommendations/routing
export async function routingRecommendationsGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const rangeDays = parseInt(String(req.query.rangeDays || "7"), 10);
    const recommendations = await routingService.generateRoutingRecommendations(
      userId,
      Number.isFinite(rangeDays) ? rangeDays : 7,
    );
    const totalSavings = recommendations.reduce(
      (sum, recommendation) => sum + recommendation.monthlySavings,
      0,
    );
    return res.json({
      success: true,
      recommendations,
      totalMonthlySavings: Math.round(totalSavings * 100) / 100,
    });
  } catch (error) {
    console.error("ai-observability routingRecommendationsGet error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch routing recommendations",
      });
  }
}
