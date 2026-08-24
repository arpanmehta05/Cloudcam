import { Request, Response } from "express";
import { setupSseStream } from "../../../modules/terraform/services/deployment/deployment.service";
import { loadUserCreds } from "./helpers";

// GET /api/aws/resources/:id/action/stream — Stream logs of live deployment
export async function liveActionStreamGet(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const deploymentIdRaw = req.params.deploymentId || req.query.deploymentId;
    const deploymentId = (Array.isArray(deploymentIdRaw) ? deploymentIdRaw[0] : deploymentIdRaw) as string;
    if (!deploymentId) {
      return res.status(400).json({ success: false, error: "Missing deploymentId parameter" });
    }
    req.setTimeout(0);
    res.setTimeout(0);
    await setupSseStream(res, deploymentId, userId);
  } catch (err: any) {
    console.error("[live-action-stream] SSE error:", err);
    if (!res.headersSent) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: err?.message || "Failed to start log stream" })}\n\n`,
      );
      return res.end();
    }
  }
}
