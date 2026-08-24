import { Request, Response } from "express";
import { HclParserService } from "../services/hcl-parser.service";
import { startHclDeployment } from "../../terraform/services/deployment/deployment.service";

const parserService = new HclParserService();

function getUserId(req: Request): string | null {
  return (req as any).user?.userId || null;
}

// POST /api/simulation/hcl-playground/parse
export async function parseHclToGraph(req: Request, res: Response) {
  try {
    const { hcl } = req.body;
    if (!hcl || typeof hcl !== "string") {
      return res.status(400).json({ success: false, error: "HCL string is required" });
    }

    const result = parserService.parse(hcl);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to parse HCL code" });
  }
}

// POST /api/simulation/hcl-playground/deploy
export async function deployDirectHcl(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { hcl, region, name } = req.body;
    if (!hcl || typeof hcl !== "string") {
      return res.status(400).json({ success: false, error: "HCL string is required" });
    }

    // 1. Parse HCL to extract nodes and edges for the simulation graph representation
    const { nodes, edges, provider } = parserService.parse(hcl);

    const defaultRegion = region || (provider === "gcp" ? "us-central1" : provider === "azure" ? "eastus" : "us-east-1");

    // 2. Start deployment session storing the raw HCL directly
    const { deploymentId } = await startHclDeployment(
      userId,
      nodes,
      edges,
      defaultRegion,
      hcl,
      name || `HCL Run: ${provider}`,
      undefined
    );

    return res.json({
      success: true,
      deploymentId,
      status: "waiting_creds",
      provider,
      region: defaultRegion,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to start HCL deployment" });
  }
}
