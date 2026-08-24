/* eslint-disable import/no-restricted-paths */
import { Request, Response } from "express";
import { User } from "../models/user.model";
import {
  getMe,
  updateProfile,
  setTwoFactor,
  getSecurityEvents,
  recordSecurityEvent,
} from "../services";
import { sendDeletionScheduledEmail } from "../../../services/email.service";

export async function meHandler(req: Request, res: Response) {
  try {
    const ip =
      req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1";
    const userAgent = (req.headers["user-agent"] as string) || "";
    const user = await getMe((req as any).user.userId, ip, userAgent);
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
}

export async function updateProfileHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = await updateProfile((req as any).user.userId, {
      name: typeof req.body?.name === "string" ? req.body.name : undefined,
      pinnedServices: Array.isArray(req.body?.pinnedServices)
        ? req.body.pinnedServices
        : undefined,
    });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to update profile",
    });
  }
}

export async function updateTwoFactorHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const enabled = !!req.body?.enabled;
    const user = await setTwoFactor((req as any).user.userId, enabled);
    res.json({
      success: true,
      user,
      message: enabled
        ? "Email two-factor authentication is enabled."
        : "Two-factor authentication is disabled.",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to update two-factor authentication",
    });
  }
}

export async function restoreAccountHandler(req: Request, res: Response) {
  try {
    res.status(403).json({
      success: false,
      error:
        "Account restoration is no longer available. Deactivated accounts cannot be restored.",
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to restore account",
    });
  }
}

export async function scheduleAccountDeletionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    if (user.permissionLevel !== "admin") {
      res.status(403).json({
        success: false,
        error: "Only admins are authorized to schedule account deletion",
      });
      return;
    }

    user.accountLocked = true;
    user.scheduledDeletionAt = new Date();
    user.updatedAt = new Date();
    await user.save();

    const ip =
      req.ip ||
      String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
    const userAgent = req.headers["user-agent"] || "";
    recordSecurityEvent(
      userId,
      "deletion_scheduled",
      ip,
      userAgent,
      "Scheduled account for permanent deletion",
    ).catch(() => {});

    if (user.email) {
      sendDeletionScheduledEmail({
        to: user.email,
        name: user.name || undefined,
        scheduledDeletionAt: user.scheduledDeletionAt,
      }).catch((err) => {
        console.error(
          "[Email] Failed to send account deletion schedule email:",
          err,
        );
      });
    }

    res.json({
      success: true,
      scheduledDeletionAt: user.scheduledDeletionAt,
      message:
        "Your account has been permanently deactivated. You have been logged out.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to schedule account deletion",
    });
  }
}

export async function getSecurityEventsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const events = await getSecurityEvents(userId);
    res.json({
      success: true,
      events,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve security events",
    });
  }
}
