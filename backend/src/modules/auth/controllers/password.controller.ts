/* eslint-disable import/no-restricted-paths */
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import {
  startForgotPassword,
  verifyPasswordResetOtp,
  resetPassword,
  setPassword,
  generateToken,
  formatUser,
  recordSecurityEvent,
} from "../services";
import { sendOtp, verifyOtp } from "../../../services/otp.service";
import { errorStatus, authErrorMessage, normalizeOtp } from "./utils";

export async function forgotPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== "string") {
      res.status(400).json({ success: false, error: "Email is required" });
      return;
    }

    const result = await startForgotPassword(email);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    if (errorStatus(error, 500) === 429) {
      const email = String(req.body?.email || "")
        .toLowerCase()
        .trim();
      res.status(200).json({
        success: true,
        email,
        message:
          error.message ||
          "A code was already sent. Please wait before requesting another OTP.",
        resendAfterSecs: error.resendAfterSecs,
      });
      return;
    }

    res.status(errorStatus(error, 500)).json({
      success: false,
      error: authErrorMessage(
        error,
        "Failed to send reset email. Try again later.",
      ),
      resendAfterSecs: error.resendAfterSecs,
    });
  }
}

export async function verifyForgotPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { email } = req.body as { email?: string };
    const code = normalizeOtp(req.body?.code);

    if (!email || code.length !== 6) {
      res.status(400).json({
        success: false,
        error: "Email and a 6 digit OTP are required",
      });
      return;
    }

    const result = await verifyPasswordResetOtp(email, code);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function resetPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { email, resetToken, newPassword } = req.body as {
      email?: string;
      resetToken?: string;
      newPassword?: string;
    };

    if (!email || !resetToken || !newPassword) {
      res.status(400).json({
        success: false,
        error: "Email, reset token, and new password are required",
      });
      return;
    }

    const result = await resetPassword(email, resetToken, newPassword);
    res.status(200).json({
      success: true,
      notificationSent: result.notificationSent,
      message: result.notificationSent
        ? "Password updated successfully. A security confirmation email has been sent."
        : "Password updated successfully. Security confirmation email could not be sent right now.",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to reset password. Try again.",
    });
  }
}

export async function setPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { password, otpCode } = req.body as {
      password?: string;
      otpCode?: string;
    };
    if (!password || password.length < 6) {
      res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
      return;
    }

    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    if (user.email) {
      if (!otpCode) {
        const otpResult = await sendOtp(
          user.email,
          "password-change",
          user.name,
        );
        if (!otpResult.success) {
          res.status(400).json({
            success: false,
            error: otpResult.message,
            resendAfterSecs: otpResult.resendAfterSecs,
          });
          return;
        }
        res.json({
          success: true,
          requiresOtp: true,
          message:
            "A verification code has been sent to your email to confirm this password change.",
        });
        return;
      }

      const verifyResult = await verifyOtp(
        user.email,
        otpCode,
        "password-change",
      );
      if (!verifyResult.valid) {
        res.status(400).json({ success: false, error: verifyResult.message });
        return;
      }
    }

    const result = await setPassword(userId, password);
    const ip =
      req.ip ||
      String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
    const userAgent = req.headers["user-agent"] || "";
    recordSecurityEvent(
      userId,
      "password_changed",
      ip,
      userAgent,
      "Changed account password",
    ).catch(() => {});
    res.json({
      success: true,
      notificationSent: result.notificationSent,
      message: result.notificationSent
        ? "Password updated successfully. A security confirmation email has been sent."
        : "Password updated successfully. Security confirmation email could not be sent right now.",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to set password",
    });
  }
}

export async function resetPasswordFirstLoginHandler(
  req: Request,
  res: Response,
) {
  try {
    const { userId, currentPassword, newPassword } = req.body as {
      userId?: string;
      currentPassword?: string;
      newPassword?: string;
    };
    if (!userId || !currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: "User ID, current password, and new password are required",
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user || !user.requiresPasswordReset) {
      res.status(400).json({
        success: false,
        error: "Password reset not required or user not found",
      });
      return;
    }

    if (!user.passwordHash) {
      res
        .status(400)
        .json({ success: false, error: "Invalid user account type" });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      res
        .status(400)
        .json({ success: false, error: "Invalid current password" });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.requiresPasswordReset = false;
    user.updatedAt = new Date();
    await user.save();

    const ip =
      req.ip ||
      String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
    const userAgent = req.headers["user-agent"] || "";
    recordSecurityEvent(
      userId,
      "password_changed",
      ip,
      userAgent,
      "Reset password on first login",
    ).catch(() => {});

    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: formatUser(user),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to reset password",
    });
  }
}
