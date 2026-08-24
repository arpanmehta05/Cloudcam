import { Request, Response } from "express";
import { getInsights } from "../services/insights.service";
import { loadUserCreds } from "./helpers";

export async function insightsGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const region = req.query.region as string;
    const data = await getInsights(userId, region, roleArn, externalId);
    res.json({
      success: true,
      insights: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API Insights] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch insights",
      });
  }
}
