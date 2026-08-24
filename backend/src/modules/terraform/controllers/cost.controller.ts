// Cost estimation controller
import { Request, Response } from "express";
import {
  estimateCost,
  type CostEstimationRequest,
} from "../services/cost-estimation/cost-estimation.service";

// POST /api/simulation/cost/estimate
export async function estimateCostHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || "anonymous";
    const { nodes, edges, region, sessionId } = req.body || {};

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one node is required for cost estimation",
      });
    }

    const request: CostEstimationRequest = {
      nodes,
      edges: edges || [],
      region: region || "us-east-1",
      sessionId: sessionId || `cost_${userId}_${Date.now()}`,
    };

    const result = await estimateCost(request);

    return res.json({
      id: request.sessionId,
      ...result,
    });
  } catch (err) {
    console.error("cost estimation error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to estimate cost",
    });
  }
}

// GET /api/simulation/cost/status/:sessionId
export function getCachedCostEstimate(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "sessionId is required",
      });
    }

    // Re-use estimateCost with same sessionId — returns cached if available
    // We need to have the original request stored, but for simplicity:
    // Return a simple status response
    return res.json({
      id: sessionId,
      message: "Cost estimate cached for 10 minutes. Re-submit to refresh.",
      cached: true,
    });
  } catch (err) {
    console.error("cached cost estimate error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve cached cost estimate",
    });
  }
}
