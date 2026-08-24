import { Request, Response } from "express";
import { createSession } from "../../../store/deployment-store";
import { generateLiveActionHcl } from "../services/live-action-hcl.service";
import { getLiveLambdaCode } from "../services/live-lambda.service";
import { checkLiveActionSafety } from "../services/live-safety.service";
import { randomUUID } from "crypto";
import { loadUserCreds } from "./helpers";

export * from "./live-action-stream.controller";

// POST /api/aws/resources/:id/action
export async function liveActionPost(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const resourceIdParam = req.params.id;
    const resourceId = (Array.isArray(resourceIdParam) ? resourceIdParam[0] : resourceIdParam) as string;
    let { action, service, region } = req.body;

    if (!action || !service || !region) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    if (region === "all") {
      region = "us-east-1";
    }

    // RDS snapshot start/stop safeguard
    if (service === "rds" && (action === "start" || action === "stop") && req.body.isSnapshot === true) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Cannot start or stop an RDS snapshot.",
        });
    }

    const hcl = await generateLiveActionHcl(userId, resourceId, action, service, region, req.body);

    const deploymentId = `live-${randomUUID()}`;
    await createSession(
      deploymentId,
      userId,
      [],
      [],
      region,
      `Live Action: ${action} ${service} ${resourceId}`,
      undefined,
      hcl,
    );

    res.json({ success: true, deploymentId });
  } catch (error: any) {
    console.error("[liveActionPost]", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/aws/resources/:id/code
export async function liveLambdaGetCode(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const resourceIdParam = req.params.id;
    const resourceId = (Array.isArray(resourceIdParam) ? resourceIdParam[0] : resourceIdParam) as string;
    const region = (req.query.region as string) || "us-east-1";

    const result = await getLiveLambdaCode(userId, resourceId, region);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[liveLambdaGetCode]", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/aws/resources/:id/safety-check
export async function liveActionSafetyCheck(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const resourceIdParam = req.params.id;
    const resourceId = (Array.isArray(resourceIdParam) ? resourceIdParam[0] : resourceIdParam) as string;
    const service = req.query.service as string;
    let region = req.query.region as string || "us-east-1";

    if (!service) {
      return res.status(400).json({ success: false, error: "Missing service query parameter" });
    }

    if (region === "all") {
      region = "us-east-1";
    }

    const result = await checkLiveActionSafety(userId, resourceId, service, region);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[liveActionSafetyCheck]", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
