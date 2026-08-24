import { Request, Response } from "express";
import { getNotificationSettings, updateNotificationSettings } from "../services";
import { logger } from "../../../core/logger";
import { ok, fail } from "../../../shared/responses";

function getUserId(req: Request): string {
  return (req as any).user.userId;
}

export async function getNotificationSettingsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const settings = await getNotificationSettings(userId);
    res.json(ok({ settings }));
  } catch (error: any) {
    logger.error(`[Notifications-Controller] Failed to get settings: ${error.message}`);
    res.status(500).json(fail(error));
  }
}

export async function putNotificationSettingsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const { slack, email } = req.body || {};
    const settings = await updateNotificationSettings(userId, { slack, email });
    res.json(ok({ settings }));
  } catch (error: any) {
    logger.error(`[Notifications-Controller] Failed to update settings: ${error.message}`);
    const status = error.message.includes("must start with") ? 400 : 500;
    res.status(status).json(fail(error));
  }
}
