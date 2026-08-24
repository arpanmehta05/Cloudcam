// Non-AWS Controllers: Watchdog, AI, Chat
import { Request, Response } from "express";
import { getWatchdogData } from "../services/watchdog.service";
import { analyzeInfrastructure } from "../services/ai.service";
import { processChat } from "../services/chat.service";
import { toErrorResponse } from "../../../errors/app-error";

// ─── Watchdog ───
export async function watchdogGet(req: Request, res: Response) {
  try {
    const timeRange = (req.query.timeRange as string) || "24h";
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const data = await getWatchdogData(timeRange, userId, roleArn, externalId);
    res.json(data);
  } catch (error) {
    console.error("Watchdog API error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch metrics" });
  }
}

// ─── AI Analysis ───
async function loadUserCreds(req: Request) {
  const userId = (req as any).user.userId;
  const { getCredentials } = await import("../../../store/workspace-credentials");
  const creds = await getCredentials(userId);
  return {
    userId,
    roleArn: creds?.roleArn,
    externalId: creds?.externalId,
  };
}

export async function aiPost(req: Request, res: Response) {
  const t0 = Date.now();
  const { userId, roleArn, externalId } = await loadUserCreds(req);

  try {
    const t1 = Date.now();
    const result = await analyzeInfrastructure(userId, roleArn, externalId);
    const t2 = Date.now();

    const ms = { total: t2 - t0, analysis: t2 - t1, creds: t1 - t0 };
    console.log(
      `[AI] POST /api/ai — total: ${ms.total}ms | creds: ${ms.creds}ms | analysis: ${ms.analysis}ms | source: ${result.source} | recs: ${result.insights.recommendations.length} | diag: ${result.insights.diagnosis.length} | opts: ${result.insights.optimizations.length}`,
    );

    res.json(result);
  } catch (error) {
    const elapsed = Date.now() - t0;
    const mapped = toErrorResponse(error);
    console.error(
      `[AI] POST /api/ai failed after ${elapsed}ms — code: ${mapped.body.code} error: ${mapped.body.error}`,
      error instanceof Error ? error.stack : "",
    );
    res.status(mapped.status).json(mapped.body);
  }
}

// ─── Chat ───
export async function chatPost(req: Request, res: Response) {
  try {
    const { message, sessionId } = req.body;
    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Message is required" });
    }
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const result = await processChat(
      message,
      sessionId,
      userId,
      roleArn,
      externalId,
    );
    res.json(result);
  } catch (error) {
    const mapped = toErrorResponse(error);
    console.error("Chat API error:", mapped.body.code, mapped.body.error);
    res.status(mapped.status).json(mapped.body);
  }
}
