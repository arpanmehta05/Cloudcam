// Optimization Controller — REST endpoints for cost-optimization engine
import { Request, Response } from "express";
import {
  getOptimizationInsights,
  validateInsight,
} from "../services/optimization";
import { getCredentials } from "../../../store/workspace-credentials";
import {
  isNotConnectedError,
  notConnectedResponse,
} from "../../../middleware/error-handler";
import {
  getCached,
  setCached,
  CacheTTL,
} from "../../../middleware/response-cache";

async function loadUserCreds(req: Request) {
  const userId = (req as any).user.userId;
  const creds = await getCredentials(userId);
  return {
    userId,
    roleArn: creds?.roleArn,
    externalId: creds?.externalId,
  };
}

// GET /api/aws/optimization — Returns cached or fresh insights
export async function optimizationGet(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const region = req.query.region as string | undefined;

    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);

    const result = await getOptimizationInsights(
      userId,
      userId, // workspaceId = userId in this architecture
      roleArn,
      externalId,
      false, // don't force refresh
      region,
    );

    const response = {
      success: true,
      data: {
        insights: result.insights,
        opportunities: result.opportunities,
        scenarios: result.scenarios,
        pricingBreakdown: result.pricingBreakdown,
        totalPotentialSavings: result.totalPotentialSavings,
        generatedAt: result.generatedAt,
        fromCache: result.fromCache,
        learning: result.learning,
      },
    };
    setCached(userId, req, response, CacheTTL.INSIGHTS);
    res.json(response);
  } catch (err: any) {
    if (isNotConnectedError(err)) return notConnectedResponse(res, err);
    console.error("[Optimization] GET failed:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch optimization insights",
    });
  }
}

// POST /api/aws/optimization/refresh — Force-refresh insights
export async function optimizationRefreshPost(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const region = req.query.region as string | undefined;

    const result = await getOptimizationInsights(
      userId,
      userId,
      roleArn,
      externalId,
      true, // force refresh
      region,
    );

    res.json({
      success: true,
      data: {
        insights: result.insights,
        opportunities: result.opportunities,
        scenarios: result.scenarios,
        pricingBreakdown: result.pricingBreakdown,
        totalPotentialSavings: result.totalPotentialSavings,
        generatedAt: result.generatedAt,
        fromCache: false,
        learning: result.learning,
      },
    });
  } catch (err: any) {
    if (isNotConnectedError(err)) return notConnectedResponse(res, err);
    console.error("[Optimization] Refresh failed:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to refresh optimization insights",
    });
  }
}

// POST /api/aws/optimization/validate/:insightId — Pre-execution revalidation
export async function optimizationValidatePost(req: Request, res: Response) {
  try {
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const insightId = req.params.insightId as string;
    const forceEmptyDelete = Boolean((req.body || {}).forceEmptyDelete);

    if (!insightId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing insightId parameter" });
    }

    const result = await validateInsight(
      insightId,
      userId,
      userId,
      roleArn,
      externalId,
      { forceEmptyDelete },
    );

    res.json({
      success: true,
      validation: result,
    });
  } catch (err: any) {
    console.error("[Optimization] Validate failed:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to validate insight",
    });
  }
}
