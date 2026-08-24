/* eslint-disable import/no-restricted-paths */
import { Request, Response } from "express";
import { getVpsLogSummary, clearRecentVpsLogs } from "../services";
import { logger } from "../../../core/logger";
import { ok, fail } from "../../../shared/responses";
import { VpsLogLevel, VpsLogSource } from "../models/vps-log-entry.model";

export async function vpsLogSummaryGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const hours = req.query.hours
      ? parseInt(req.query.hours as string, 10)
      : undefined;
    const start = (req.query.start as string) || undefined;
    const end = (req.query.end as string) || undefined;
    const agentId = (req.query.agentId as string) || undefined;
    const rawSource = (req.query.source as string) || "";
    const source =
      rawSource === "docker" ||
      rawSource === "pm2" ||
      rawSource === "system" ||
      rawSource === "nginx" ||
      rawSource === "apache"
        ? (rawSource as VpsLogSource)
        : undefined;
    const rawLevel = (req.query.level as string) || "";
    const level =
      rawLevel === "error" ||
      rawLevel === "warn" ||
      rawLevel === "info" ||
      rawLevel === "debug"
        ? (rawLevel as VpsLogLevel)
        : undefined;
    const service = (req.query.service as string) || undefined;
    const q = (req.query.q as string) || undefined;

    const summary = await getVpsLogSummary(userId, {
      hours,
      start,
      end,
      agentId,
      source,
      level,
      service,
      q,
    });
    return res.json(summary);
  } catch (error: any) {
    logger.error("vpsLogSummaryGet error:", error);
    return res
      .status(500)
      .json(fail("Failed to fetch VPS log summary"));
  }
}

export async function vpsLogsClearRecentDelete(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const hours = req.query.hours
      ? parseInt(req.query.hours as string, 10)
      : 24;
    const agentId = (req.query.agentId as string) || undefined;
    const rawSource = (req.query.source as string) || "";
    const source =
      rawSource === "docker" ||
      rawSource === "pm2" ||
      rawSource === "system" ||
      rawSource === "nginx" ||
      rawSource === "apache"
        ? (rawSource as VpsLogSource)
        : undefined;

    const result = await clearRecentVpsLogs(userId, { hours, agentId, source });
    return res.json(ok(result));
  } catch (error: any) {
    logger.error("vpsLogsClearRecentDelete error:", error);
    const status = /not found/i.test(error?.message || "") ? 404 : 500;
    return res
      .status(status)
      .json(fail(error?.message || "Failed to clear recent logs"));
  }
}
