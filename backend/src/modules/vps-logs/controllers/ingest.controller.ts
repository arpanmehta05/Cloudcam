import { Request, Response } from "express";
import { ingestVpsLogs, runVpsLogAlertMailTest } from "../services";
import { logger } from "../../../core/logger";
import { ok, fail } from "../../../shared/responses";

export async function vpsLogIngestPost(req: Request, res: Response) {
  try {
    const agentId = req.header("x-agent-id") || "";
    const ingestKey = req.header("x-ingest-key") || "";

    const payload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const accepted = await ingestVpsLogs(payload, agentId, ingestKey);
    return res.json(ok(accepted));
  } catch (error: any) {
    logger.error("vpsLogIngestPost error:", error);
    const status = error?.status || (/invalid|unknown|missing/i.test(error?.message || "")
      ? 401
      : 500);
    return res
      .status(status)
      .json(fail(error?.message || "Failed to ingest logs"));
  }
}

export async function vpsLogAlertMailTestPost(req: Request, res: Response) {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json(fail("Not found"));
    }

    const testSecret = req.header("x-test-secret") || "";
    if (!process.env.JWT_SECRET || testSecret !== process.env.JWT_SECRET) {
      return res.status(401).json(fail("Invalid test secret"));
    }

    const { agentId } = req.body || {};
    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json(fail("agentId is required"));
    }

    const result = await runVpsLogAlertMailTest(agentId);
    return res.json(ok(result));
  } catch (error: any) {
    logger.error("vpsLogAlertMailTestPost error:", error);
    const status = /not found/i.test(error?.message || "") ? 404 : 500;
    return res
      .status(status)
      .json(fail(error?.message || "Failed to run VPS alert mail test"));
  }
}
