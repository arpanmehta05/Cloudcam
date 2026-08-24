import { Request, Response } from "express";
import { hasExplicitEnvironment, resolveAiScope } from "../services/scope.service";
import {
  getCostAttribution,
  getEvaluationCost,
  type CostDimension,
} from "./cost-attribution.service";
import * as costTokensService from "./cost-tokens.service";

const DIMENSIONS: CostDimension[] = ["prompt", "user", "session", "endpoint", "model", "service"];

async function scopeFrom(req: Request) {
  const userId = (req as any).user.userId as string;
  const scope = await resolveAiScope(req, userId);
  if (!hasExplicitEnvironment(req)) scope.environment = undefined;
  return scope;
}

export async function tokensGet(req: Request, res: Response) {
  try {
    const range = req.query.range as string;
    const provider = typeof req.query.provider === "string" ? req.query.provider : undefined;
    const trend = await costTokensService.getTokenTrends(await scopeFrom(req), range, provider);
    return res.json({ success: true, range: range || "7d", trend });
  } catch (error) {
    console.error("ai-observability tokensGet error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch token analytics" });
  }
}

export async function costsGet(req: Request, res: Response) {
  try {
    const range = req.query.range as string;
    const provider = typeof req.query.provider === "string" ? req.query.provider : undefined;
    const result = await costTokensService.getCostTrends(await scopeFrom(req), range, provider);
    return res.json({ success: true, range: range || "30d", ...result });
  } catch (error) {
    console.error("ai-observability costsGet error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch cost analytics" });
  }
}

export async function costAttributionGet(req: Request, res: Response) {
  try {
    const dimension = DIMENSIONS.includes(req.query.dimension as CostDimension)
      ? (req.query.dimension as CostDimension)
      : "prompt";
    const days = parseInt(req.query.days as string, 10) || 30;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const result = await getCostAttribution(await scopeFrom(req), dimension, days, limit);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("ai-observability costAttributionGet error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch cost attribution" });
  }
}

export async function evaluationCostGet(req: Request, res: Response) {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const summary = await getEvaluationCost(await scopeFrom(req), days);
    return res.json({ success: true, summary });
  } catch (error) {
    console.error("ai-observability evaluationCostGet error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch evaluation cost" });
  }
}
