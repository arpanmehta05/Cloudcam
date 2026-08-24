import { logger } from "../../../core/logger";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User, IUser } from "../models/user.model";
import { PasswordResetToken } from "../../../models/password-reset-token.model";
import { SecurityEvent } from "../../../models/security-event.model";
import { sendOtp, verifyOtp } from "../../../services/otp.service";
import { sendPasswordChangedEmail } from "../../../services/email.service";
import { OtpStartResult } from "./login.service";

const PASSWORD_RESET_TOKEN_EXPIRY_MINS = 15;

export interface PasswordUpdateResult {
  notificationSent: boolean;
}

export async function recordSecurityEvent(
  userId: string,
  action: string,
  ip: string,
  userAgent: string,
  details?: string,
): Promise<void> {
  try {
    await SecurityEvent.create({
      userId,
      action,
      ip,
      userAgent,
      details,
    });
  } catch (err) {
    logger.error("[SecurityEvent] Failed to log security event:", err);
  }
}

export async function getSecurityEvents(userId: string): Promise<any[]> {
  return SecurityEvent.find({ userId, action: { $ne: "login" } })
    .sort({ createdAt: -1 })
    .limit(100);
}

export async function startForgotPassword(
  email: string,
): Promise<OtpStartResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).lean();

  if (user) {
    const otpResult = await sendOtp(
      normalizedEmail,
      "password-reset",
      user.name,
    );
    if (!otpResult.success) {
      const error = new Error(otpResult.message);
      (error as any).status = 429;
      (error as any).resendAfterSecs = otpResult.resendAfterSecs;
      throw error;
    }
  }

  return {
    email: normalizedEmail,
    message: "If that email is registered, a verification code has been sent.",
  };
}

export async function verifyPasswordResetOtp(
  email: string,
  code: string,
): Promise<{ resetToken: string; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).lean();
  if (!user) throw new Error("Invalid or expired verification code.");

  const otpResult = await verifyOtp(normalizedEmail, code, "password-reset");
  if (!otpResult.valid) throw new Error(otpResult.message);

  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(resetToken, 12);
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINS * 60 * 1000,
  );

  await PasswordResetToken.deleteMany({ email: normalizedEmail });
  await PasswordResetToken.create({ email: normalizedEmail, tokenHash, expiresAt });

  return {
    resetToken,
    message: "Email verified. You can now reset your password.",
  };
}

async function sendPasswordChangeNotification(
  user: IUser,
  changedAt: Date,
): Promise<boolean> {
  if (!user.email) {
    logger.info(
      `[Auth] Skipping password change email: no email configured for user ${
        user.username || user._id
      }`,
    );
    return true;
  }
  try {
    await sendPasswordChangedEmail({
      to: user.email,
      name: user.name,
      changedAt,
    });
    return true;
  } catch (error: any) {
    logger.error(
      `[Auth] Password change email failed for ${user.email}:`,
      error?.message || error,
    );
    return false;
  }
}

export async function resetPassword(
  email: string,
  resetToken: string,
  newPassword: string,
): Promise<PasswordUpdateResult> {
  const normalizedEmail = email.toLowerCase().trim();
  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const record = await PasswordResetToken.findOne({ email: normalizedEmail }).sort({
    createdAt: -1,
  });
  if (!record || record.expiresAt < new Date()) {
    if (record) await record.deleteOne();
    throw new Error(
      "Password reset session expired. Please request a new code.",
    );
  }

  const isValidToken = await bcrypt.compare(resetToken, record.tokenHash);
  if (!isValidToken) throw new Error("Invalid password reset session.");

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) throw new Error("User not found");

  const changedAt = new Date();
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await record.deleteOne();
  const notificationSent = await sendPasswordChangeNotification(user, changedAt);

  return { notificationSent };
}

export async function setPassword(
  userId: string,
  password: string,
): Promise<PasswordUpdateResult> {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const changedAt = new Date();
  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();
  const notificationSent = await sendPasswordChangeNotification(user, changedAt);

  return { notificationSent };
}
