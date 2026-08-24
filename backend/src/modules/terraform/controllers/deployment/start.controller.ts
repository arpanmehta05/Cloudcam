import { Request, Response } from "express";
import { startDeployment } from "../../services/deployment/deployment.service";
import { getUserId } from "./shared";

// POST /api/deployment/start
export async function deploymentStartPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { nodes, edges, region, name, draftId } = req.body || {};

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one node is required for deployment",
      });
    }

    const result = await startDeployment(
      userId,
      nodes,
      edges,
      region || "us-east-1",
      name,
      draftId,
    );
    const { deploymentId } = result;

    return res.json({
      success: true,
      deploymentId,
      status: "waiting_creds",
    });
  } catch (err: any) {
    console.error("[deployment] Start error:", err);
    require("fs").writeFileSync(
      "deploy_error.log",
      err?.stack || err?.message || String(err),
    );
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to start deployment",
    });
  }
}
