import { Request, Response } from "express";
import * as keyStoreService from "../services/key-store.service";

// ─── Save / Update API Key ──────────────────────────────────────
export async function saveAiKeyPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const { provider, apiKey } = req.body;

    if (!provider || !apiKey) {
      return res
        .status(400)
        .json({ success: false, error: "provider and apiKey are required" });
    }
    if (!["openai", "anthropic", "gemini", "nvidia"].includes(provider)) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "provider must be 'openai', 'anthropic', 'gemini', or 'nvidia'",
        });
    }

    const validation = await keyStoreService.saveApiKey(userId, provider, apiKey);
    res.json({ success: true, provider, models: validation.models });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

// ─── Delete API Key ─────────────────────────────────────────────
export async function deleteAiKeyPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const { provider } = req.body;

    if (!["openai", "anthropic", "gemini", "nvidia"].includes(provider)) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "provider must be 'openai', 'anthropic', 'gemini', or 'nvidia'",
        });
    }

    await keyStoreService.deleteApiKey(userId, provider);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── Get Key Status ─────────────────────────────────────────────
export async function getAiKeysStatus(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const keys = await keyStoreService.getKeysStatus(userId);
    res.json({ success: true, keys });
  } catch (error: any) {
    res.status(error.message === "User not found" ? 404 : 500).json({
      success: false,
      error: error.message,
    });
  }
}
