import { Request, Response } from "express";
import { User, decryptKey } from "../../../models/user.model";
import {
  getOpenAIUsage,
  getOpenAIUsageLogs,
  getOpenAIPerKeyUsage,
  validateAnthropicKey,
  validateGeminiKey,
  CLAUDE_PRICING,
  OPENAI_PRICING,
  GEMINI_PRICING,
} from "../services/usage.service";

// ─── OpenAI Usage ───────────────────────────────────────────────
export async function getOpenAIUsageHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const data = await getOpenAIUsage(userId, days);
    const hasData = !!(
      data.completions ||
      data.costs ||
      data.embeddings ||
      data.images
    );
    res.json({ success: true, hasData, provider: "openai", days, ...data });
  } catch (error: any) {
    const msg = String(error.message || "Unknown error").slice(0, 300);
    console.error("[ai-keys] OpenAI usage error:", msg);
    res.status(msg.includes("not configured") ? 400 : 502).json({
      success: false,
      error: msg,
    });
  }
}

// ─── OpenAI Usage Logs (hourly + audit) ─────────────────────────
export async function getOpenAILogsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const days = Math.min(parseInt(req.query.days as string) || 7, 7); // max 7 days for hourly logs
    const data = await getOpenAIUsageLogs(userId, days);
    res.json({ success: true, provider: "openai", days, ...data });
  } catch (error: any) {
    const msg = String(error.message || "Unknown error").slice(0, 300);
    console.error("[ai-keys] OpenAI logs error:", msg);
    res.status(msg.includes("not configured") ? 400 : 502).json({
      success: false,
      error: msg,
    });
  }
}

// ─── OpenAI Per-Key Usage ───────────────────────────────────────
export async function getOpenAIPerKeyHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const data = await getOpenAIPerKeyUsage(userId, days);
    res.json({ success: true, provider: "openai", days, ...data });
  } catch (error: any) {
    const msg = String(error.message || "Unknown error").slice(0, 300);
    console.error("[ai-keys] OpenAI per-key error:", msg);
    res.status(msg.includes("not configured") ? 400 : 502).json({
      success: false,
      error: msg,
    });
  }
}

// ─── Anthropic Usage (local tracking placeholder + pricing) ─────
export async function getAnthropicUsageHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user?.aiApiKeys?.anthropic?.apiKey) {
      return res
        .status(400)
        .json({ success: false, error: "Anthropic API key not configured" });
    }

    // Validate key still works & return available models
    const apiKey = decryptKey(user.aiApiKeys.anthropic.apiKey);
    const validation = await validateAnthropicKey(apiKey);

    res.json({
      success: true,
      provider: "anthropic",
      keyValid: validation.valid,
      models: validation.models,
      pricing: CLAUDE_PRICING,
      note: "Anthropic does not provide an organization usage API. Usage tracking requires local instrumentation.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── Gemini Usage ───────────────────────────────────────────────
export async function getGeminiUsageHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user?.aiApiKeys?.gemini?.apiKey) {
      return res
        .status(400)
        .json({ success: false, error: "Gemini API key not configured" });
    }

    const apiKey = decryptKey(user.aiApiKeys.gemini.apiKey);
    const validation = await validateGeminiKey(apiKey);

    res.json({
      success: true,
      provider: "gemini",
      keyValid: validation.valid,
      models: validation.models,
      pricing: GEMINI_PRICING,
      note: "Google does not provide an organization-level usage API for Gemini. Usage tracking requires Google Cloud billing console.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── Pricing Reference ─────────────────────────────────────────
export async function getPricingHandler(_req: Request, res: Response) {
  res.json({
    success: true,
    openai: OPENAI_PRICING,
    anthropic: CLAUDE_PRICING,
    gemini: GEMINI_PRICING,
  });
}
