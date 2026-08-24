import { Request, Response } from "express";
import {
  createVpsLogAgent,
  updateVpsLogAgentConfig,
  listVpsLogAgents,
  deleteVpsLogAgent,
} from "../services";
import { logger } from "../../../core/logger";
import { ok, fail } from "../../../shared/responses";

export async function createVpsAgentPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const { name, vpcId, environment } = req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json(fail("Agent name is required"));
    }

    const result = await createVpsLogAgent(userId, {
      name,
      vpcId,
      environment,
    });
    return res.json(ok(result));
  } catch (error: any) {
    logger.error("createVpsAgentPost error:", error);
    return res
      .status(500)
      .json(fail("Failed to create VPS log agent"));
  }
}

export async function vpsAgentsGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const agents = await listVpsLogAgents(userId);
    return res.json(ok({ agents }));
  } catch (error: any) {
    logger.error("vpsAgentsGet error:", error);
    return res.status(500).json(fail("Failed to fetch agents"));
  }
}

export async function vpsAgentConfigPatch(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const agentId = String(req.params.agentId);
    const { name, collectionInterval, enabledSources, status } = req.body || {};

    const result = await updateVpsLogAgentConfig(userId, agentId, {
      name,
      collectionInterval: collectionInterval
        ? parseInt(collectionInterval, 10)
        : undefined,
      enabledSources,
      status,
    });

    return res.json(ok({ agent: result }));
  } catch (error: any) {
    logger.error("vpsAgentConfigPatch error:", error);
    const status = /not found/i.test(error?.message || "") ? 404 : 400;
    return res
      .status(status)
      .json(fail(error?.message || "Failed to update agent config"));
  }
}

export async function vpsAgentDelete(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const agentId = (req.query.agentId as string) || "";

    if (!agentId) {
      return res.status(400).json(fail("agentId is required"));
    }

    const result = await deleteVpsLogAgent(userId, agentId);
    if (!result.deleted) {
      return res.status(404).json(fail("Agent not found"));
    }

    return res.json(ok(result));
  } catch (error: any) {
    logger.error("vpsAgentDelete error:", error);
    return res
      .status(500)
      .json(fail(error?.message || "Failed to delete agent"));
  }
}
