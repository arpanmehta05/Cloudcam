import { Request, Response } from "express";
import { getCredentials } from "../../../store/workspace-credentials";
import { getBedrockConsoleMetrics, syncBedrockMetrics } from "../../../services/aws/bedrock-metrics.service";

// GET /api/ai-observability/bedrock/console
export async function bedrockConsoleGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const window =
      typeof req.query.window === "string" ? req.query.window : undefined;
    const region =
      typeof req.query.region === "string" ? req.query.region : undefined;
    const modelId =
      typeof req.query.modelId === "string" ? req.query.modelId : undefined;
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 100)
      : 50;

    const creds = await getCredentials(userId);
    if (!creds?.roleArn || !creds?.externalId) {
      return res.status(400).json({
        success: false,
        error: "AWS account not connected",
        notConnected: true,
        code: "ERR_AWS_NOT_CONNECTED",
      });
    }

    const metrics = await getBedrockConsoleMetrics(
      userId,
      creds.roleArn,
      creds.externalId,
      {
        window,
        region,
        modelId,
        limit,
      },
    );

    return res.json({ success: true, metrics });
  } catch (error) {
    console.error("ai-observability bedrockConsoleGet error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch Bedrock console metrics",
      });
  }
}

// POST /api/ai-observability/bedrock/sync
export async function bedrockSyncPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const region =
      typeof req.query.region === "string" ? req.query.region : "us-east-1";
    const daysRaw = parseInt(String(req.query.daysBack || "1"), 10);
    const daysBack = Number.isFinite(daysRaw)
      ? Math.min(Math.max(daysRaw, 1), 30)
      : 1;

    const creds = await getCredentials(userId);
    if (!creds?.roleArn || !creds?.externalId) {
      return res.status(400).json({
        success: false,
        error: "AWS account not connected",
        notConnected: true,
        code: "ERR_AWS_NOT_CONNECTED",
      });
    }

    const result = await syncBedrockMetrics(
      userId,
      creds.roleArn,
      creds.externalId,
      region,
      daysBack,
    );
    return res.json({ success: true, region, daysBack, result });
  } catch (error) {
    console.error("ai-observability bedrockSyncPost error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to sync Bedrock metrics" });
  }
}
