import { Request, Response } from "express";
import * as ingestKeyService from "../services/ingestion/ingest-key.service";

// GET /api/ai-observability/ingest-keys
export async function ingestKeysGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const keys = await ingestKeyService.listIngestKeys(userId);
    return res.json({ success: true, keys });
  } catch (error) {
    console.error("ai ingestKeysGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to list ingest keys" });
  }
}

// POST /api/ai-observability/ingest-keys
export async function ingestKeysPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const { name, scopes } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "name is required" });
    }

    const requestedScopes = Array.isArray(scopes) ? scopes : undefined;
    if (requestedScopes?.some((scope) => !ingestKeyService.SUPPORTED_SCOPES.includes(scope))) {
      return res
        .status(400)
        .json({
          success: false,
          error: `scopes must be one of: ${ingestKeyService.SUPPORTED_SCOPES.join(", ")}`,
        });
    }

    const key = await ingestKeyService.createIngestKey(userId, {
      name,
      scopes: requestedScopes,
      actorId: userId,
    });
    return res.status(201).json({ success: true, key });
  } catch (error) {
    console.error("ai ingestKeysPost error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to create ingest key" });
  }
}

// POST /api/ai-observability/ingest-keys/:id/rotate
export async function ingestKeyRotate(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, scopes } = req.body || {};
    const requestedScopes = Array.isArray(scopes) ? scopes : undefined;
    if (requestedScopes?.some((scope) => !ingestKeyService.SUPPORTED_SCOPES.includes(scope))) {
      return res.status(400).json({
        success: false,
        error: `scopes must be one of: ${ingestKeyService.SUPPORTED_SCOPES.join(", ")}`,
      });
    }
    const key = await ingestKeyService.rotateIngestKey(userId, id, {
      name,
      scopes: requestedScopes,
      actorId: userId,
    });
    if (!key) {
      return res.status(404).json({ success: false, error: "Ingest key not found" });
    }
    return res.status(201).json({ success: true, key });
  } catch (error) {
    console.error("ai ingestKeyRotate error:", error);
    return res.status(500).json({ success: false, error: "Failed to rotate ingest key" });
  }
}

// DELETE /api/ai-observability/ingest-keys/:id
export async function ingestKeyDelete(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const key = await ingestKeyService.revokeIngestKey(userId, id);

    if (!key) {
      return res
        .status(404)
        .json({ success: false, error: "Ingest key not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("ai ingestKeyDelete error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to revoke ingest key" });
  }
}
