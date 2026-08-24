import { Request, Response } from "express";
import {
  getAllReportPreferences,
  sendReportEmail,
  updateReportPreferences,
} from "../services/usage-report.service";

function getUserId(req: Request): string {
  return (req as any).user.userId;
}

export async function usageReportPreferencesGet(req: Request, res: Response) {
  try {
    const preferences = await getAllReportPreferences(getUserId(req));
    res.json({ success: true, ...preferences });
  } catch (error: any) {
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to load report preferences",
      });
  }
}

export async function usageReportPreferencesPut(req: Request, res: Response) {
  try {
    const {
      type,
      enabled,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      sections,
    } = req.body || {};

    if (type !== "usage" && type !== "insight") {
      return res
        .status(400)
        .json({ success: false, error: "type must be usage or insight" });
    }
    if (enabled !== undefined && typeof enabled !== "boolean") {
      return res
        .status(400)
        .json({ success: false, error: "enabled must be a boolean" });
    }
    if (
      frequency !== undefined &&
      frequency !== "weekly" &&
      frequency !== "monthly"
    ) {
      return res
        .status(400)
        .json({ success: false, error: "frequency must be weekly or monthly" });
    }
    if (
      dayOfWeek !== undefined &&
      (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "dayOfWeek must be 0-6" });
    }
    if (
      dayOfMonth !== undefined &&
      (typeof dayOfMonth !== "number" || dayOfMonth < 1 || dayOfMonth > 31)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "dayOfMonth must be 1-31" });
    }
    if (
      timeOfDay !== undefined &&
      (typeof timeOfDay !== "string" || !/^\d{2}:\d{2}$/.test(timeOfDay))
    ) {
      return res
        .status(400)
        .json({ success: false, error: "timeOfDay must be HH:mm" });
    }
    if (
      sections !== undefined &&
      (!Array.isArray(sections) ||
        !sections.every((section) => typeof section === "string"))
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error: "sections must be an array of strings",
        });
    }

    const preferences = await updateReportPreferences(getUserId(req), type, {
      enabled,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      sections,
    });
    res.json({ success: true, preferences });
  } catch (error: any) {
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to update report preferences",
      });
  }
}

export async function usageReportTestPost(req: Request, res: Response) {
  try {
    const { type } = req.body || {};
    if (type !== "usage" && type !== "insight") {
      return res
        .status(400)
        .json({ success: false, error: "type must be usage or insight" });
    }

    const result = await sendReportEmail(getUserId(req), type, { force: true });
    if (!result.sent) {
      return res
        .status(400)
        .json({
          success: false,
          error: result.skippedReason || "Report could not be sent",
        });
    }
    res.json({ success: true, ...result });
  } catch (error: any) {
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to send report email",
      });
  }
}
