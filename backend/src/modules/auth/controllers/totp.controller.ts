import { Request, Response } from "express";
import {
  beginTotpSetup,
  confirmTotpSetup,
  removeTotpSetup,
  recordSecurityEvent,
} from "../services";
import { normalizeOtp } from "./utils";

export async function beginTotpSetupHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const result = await beginTotpSetup(userId);
    const ip =
      req.ip ||
      String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
    const userAgent = req.headers["user-agent"] || "";
    recordSecurityEvent(
      userId,
      "totp_setup_started",
      ip,
      userAgent,
      "Started Authenticator App 2FA setup",
    ).catch(() => {});
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to start authenticator setup",
    });
  }
}

export async function confirmTotpSetupHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const code = normalizeOtp(req.body?.code);
    if (code.length !== 6) {
      res.status(400).json({
        success: false,
        error: "A 6 digit authenticator code is required",
      });
      return;
    }
    const userId = (req as any).user.userId;
    const user = await confirmTotpSetup(userId, code);
    const ip =
      req.ip ||
      String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
    const userAgent = req.headers["user-agent"] || "";
    recordSecurityEvent(
      userId,
      "totp_setup_confirmed",
      ip,
      userAgent,
      "Enabled Authenticator App 2FA",
    ).catch(() => {});
    res.json({
      success: true,
      user,
      message: "Authenticator app two-factor authentication is enabled.",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to confirm authenticator setup",
    });
  }
}

export async function removeTotpSetupHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const user = await removeTotpSetup(userId);
    const ip =
      req.ip ||
      String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
    const userAgent = req.headers["user-agent"] || "";
    recordSecurityEvent(
      userId,
      "totp_removed",
      ip,
      userAgent,
      "Disabled Authenticator App 2FA",
    ).catch(() => {});
    res.json({
      success: true,
      user,
      message: "Authenticator app two-factor authentication is removed.",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to remove authenticator setup",
    });
  }
}
