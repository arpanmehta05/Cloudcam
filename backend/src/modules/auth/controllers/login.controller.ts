import { Request, Response } from "express";
import {
  login,
  verifyLogin2fa,
  resendLogin2fa,
  recordLoginEvent,
} from "../services";
import { errorStatus, normalizeOtp } from "./utils";

export async function loginHandler(req: Request, res: Response) {
  try {
    const { email, password, tenantId, username } = req.body;

    let result;
    if (tenantId && username) {
      if (!password) {
        return res
          .status(400)
          .json({ success: false, error: "Password is required" });
      }
      result = await login(undefined, password, tenantId, username);
    } else {
      if (!email || !password) {
        return res
          .status(400)
          .json({ success: false, error: "Email and password are required" });
      }
      result = await login(email, password);
    }

    if (
      !(result as any).requires2fa &&
      !(result as any).requiresPasswordReset &&
      !(result as any).deletionScheduled
    ) {
      const ip =
        req.ip ||
        String(
          req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
        );
      const userAgent = req.headers["user-agent"] || "";
      const provider = (result as any).user.username ? "team" : "email";
      await recordLoginEvent((result as any).user.id, provider, ip, userAgent);
    }
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(errorStatus(error, 401)).json({
      success: false,
      error: error.message,
      resendAfterSecs: error.resendAfterSecs,
    });
  }
}

export async function verifyLogin2faHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { email, userId } = req.body as { email?: string; userId?: string };
    const code = normalizeOtp(req.body?.code);
    const identifier = userId || email;
    if (!identifier || code.length !== 6) {
      res.status(400).json({
        success: false,
        error: "Verification identifier and 6 digit OTP are required",
      });
      return;
    }

    const result = await verifyLogin2fa(identifier, code);
    const ip =
      req.ip ||
      String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
    const userAgent = req.headers["user-agent"] || "";
    const provider = result.user.username ? "team" : "email";
    await recordLoginEvent(result.user.id, provider, ip, userAgent);

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to verify security code",
    });
  }
}

export async function resendLogin2faHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== "string") {
      res.status(400).json({ success: false, error: "Email is required" });
      return;
    }

    const result = await resendLogin2fa(email);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(errorStatus(error, 400)).json({
      success: false,
      error: error.message || "Failed to resend security code",
      resendAfterSecs: error.resendAfterSecs,
    });
  }
}
