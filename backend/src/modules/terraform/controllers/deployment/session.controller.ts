import { Request, Response } from "express";
import { cancelDeployment, setupSseStream } from "../../services/deployment/deployment.service";
import { getSession } from "../../services/deployment/store";
import { resolveSimulationKeyName } from "../../../../utils/simulation-key-name";
import { getParam, getUserId } from "./shared";

// POST /api/deployment/:id/cancel
export async function deploymentCancelPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const deploymentId = getParam(req, "id");
    const session = await getSession(deploymentId);

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Deployment not found" });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    await cancelDeployment(deploymentId);

    return res.json({
      success: true,
      deploymentId,
      status: "cancelled",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to cancel deployment",
    });
  }
}

// GET /api/deployment/:id/status
export async function deploymentStatusGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const deploymentId = getParam(req, "id");
    const session = await getSession(deploymentId);

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Deployment not found" });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    return res.json({
      success: true,
      deploymentId: session.id,
      status: session.status,
      containerId: session.containerId,
      errorMessage: session.errorMessage,
      accountId: session.accountId,
      logs: session.logs || [],
      outputs: session.outputs || {},
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to get deployment status",
    });
  }
}

// GET /api/deployment/:id/stream
export async function deploymentStreamGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const deploymentId = getParam(req, "id");
    console.log(`[deployment] SSE connection requested for ${deploymentId}`);
    
    if (typeof req.setTimeout === "function") req.setTimeout(0);
    if (typeof res.setTimeout === "function") res.setTimeout(0);

    await setupSseStream(res, deploymentId, userId);
  } catch (err: any) {
    console.error("[deployment] SSE error:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to start log stream",
      });
    }
  }
}

// GET /api/deployment/:id/download-pem
export async function deploymentPemDownloadGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const deploymentId = getParam(req, "id");
    const session = await getSession(deploymentId);

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Deployment not found" });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const privateKey = session.outputs?.private_key?.value;
    if (!privateKey) {
      return res
        .status(404)
        .json({
          success: false,
          error: "PEM key not found for this deployment",
        });
    }

    const keyName = resolveSimulationKeyName({
      outputKeyName: session.outputs?.key_name?.value,
      simulationName: session.name,
      deploymentId,
    });
    const filename = `${keyName}.pem`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/x-pem-file");
    return res.send(privateKey);
  } catch (err: any) {
    console.error("[deployment] PEM download error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to process PEM download" });
  }
}
