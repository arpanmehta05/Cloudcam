import { Request, Response } from "express";
import * as forecastService from "../services/forecast.service";
import * as anomalyService from "../services/anomaly.service";
import * as insightsService from "../services/insights.service";
import { resolveAiScope, hasExplicitEnvironment } from "../services/scope.service";

// GET /api/ai-observability/forecast
export async function forecastGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const forecast = await forecastService.generateForecast(userId);
    return res.json({ success: true, forecast });
  } catch (error) {
    console.error("ai-observability forecastGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to generate forecast" });
  }
}

// GET /api/ai-observability/anomalies
export async function anomaliesGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const scope = await resolveAiScope(req, userId);
    if (!hasExplicitEnvironment(req)) {
      scope.environment = undefined;
    }
    const anomalies = await anomalyService.detectAnomalies(scope);
    return res.json({ success: true, anomalies });
  } catch (error) {
    console.error("ai-observability anomaliesGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to detect anomalies" });
  }
}

// GET /api/ai-observability/summary/daily
export async function summaryDailyGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const date = req.query.date as string | undefined;
    const summary = await insightsService.generateDailySummary(userId, date);
    return res.json({ success: true, summary });
  } catch (error) {
    console.error("ai-observability summaryDailyGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to generate daily summary" });
  }
}

// GET /api/ai-observability/summary/weekly
export async function summaryWeeklyGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const summary = await insightsService.generateWeeklySummary(userId);
    return res.json({ success: true, summary });
  } catch (error) {
    console.error("ai-observability summaryWeeklyGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to generate weekly summary" });
  }
}
