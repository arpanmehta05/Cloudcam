import { Request, Response } from "express";
import * as persistentService from "../services/persistent/persistent.service";

function getUserId(req: Request): string | null {
  return (req as any).user?.userId || null;
}

// POST /api/simulations
export async function simulationCreatePost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const { name, region, nodes = [], edges = [], provider } = req.body;
    const sim = await persistentService.createSimulationService(userId, name, region, provider, nodes, edges);

    return res.json({ success: true, simulation: sim });
  } catch (err: any) {
    return res.status(err.message === "Name and region are required" ? 400 : 500).json({ success: false, error: err.message });
  }
}

// PUT /api/simulations/:id
export async function simulationUpdatePut(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const { name, region, nodes, edges, provider } = req.body;
    const sim = await persistentService.updateSimulationService(req.params.id as string, userId, { name, region, nodes, edges, provider });

    return res.json({ success: true, simulation: sim });
  } catch (err: any) {
    return res.status(err.message === "Simulation not found" ? 404 : 500).json({ success: false, error: err.message });
  }
}

// GET /api/simulations
export async function simulationsListGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const simulations = await persistentService.listSimulationsService(userId);
    return res.json({ success: true, simulations });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/simulations/:id
export async function simulationDetailGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const simulation = await persistentService.getSimulationDetailService(req.params.id as string, userId);
    return res.json({ success: true, simulation });
  } catch (err: any) {
    return res.status(err.message === "Simulation not found" ? 404 : 500).json({ success: false, error: err.message });
  }
}

// GET /api/simulations/:id/download-pem
export async function simulationPemDownloadGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const requestedDeploymentId =
      typeof req.query.deploymentId === "string"
        ? req.query.deploymentId
        : null;

    const { decryptedKey, filename } = await persistentService.downloadPemService(req.params.id as string, userId, requestedDeploymentId);

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/x-pem-file");
    return res.send(decryptedKey);
  } catch (err: any) {
    console.error("PEM download error:", err);
    return res
      .status(err.message === "Simulation not found" || err.message === "PEM key not found for this simulation" ? 404 : 500)
      .json({ success: false, error: err.message || "Failed to process PEM download" });
  }
}

// DELETE /api/simulations/:id
export async function simulationDelete(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    await persistentService.deleteSimulationService(req.params.id as string, userId);

    return res.json({
      success: true,
      message: "Simulation deleted successfully",
    });
  } catch (err: any) {
    return res.status(err.message === "Simulation not found" ? 404 : 500).json({ success: false, error: err.message });
  }
}

// POST /api/simulations/:id/destroy
export async function simulationDestroyPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const result = await persistentService.destroySimulationService(req.params.id as string, userId, req.body);
    return res.status(202).json({ success: true, ...result });
  } catch (err: any) {
    console.error("Simulation destroy error:", err);
    return res
      .status(err.message === "Simulation not found" ? 404 : err.message.includes("deploymentId is required") ? 400 : 500)
      .json({
        success: false,
        error: err.message || "Failed to destroy simulation",
      });
  }
}
