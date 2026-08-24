import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, decryptKey } from "../models/user.model";
import { LoginLog } from "../../../models/loginLog.model";
import { sendOtp, verifyOtp } from "../../../services/otp.service";
import { generateToken } from "./jwt.service";
import { formatUser } from "./format";
import { verifyTotp } from "./totp.service";
import { recordSecurityEvent } from "./password.service";

export interface AuthResult {
  token: string;
  user: any;
}

export interface TwoFactorRequiredResult {
  requires2fa: true;
  email?: string | null;
  userId: string;
  method: "email" | "totp";
  message: string;
  resendAfterSecs?: number;
}

export interface DeletionScheduledResult {
  deletionScheduled: true;
  userId: string;
  scheduledDeletionAt: Date;
  message: string;
}

export interface PasswordResetRequiredResult {
  requiresPasswordReset: true;
  userId: string;
  message: string;
}

export interface OtpStartResult {
  email: string;
  message: string;
  resendAfterSecs?: number;
}

export function parseUserAgent(uaString: string): string {
  if (!uaString) return "Unknown Device";

  // Resolve OS
  let os = "Unknown OS";
  if (/windows/i.test(uaString)) os = "Windows";
  else if (/macintosh|mac os x/i.test(uaString)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(uaString)) os = "iOS";
  else if (/android/i.test(uaString)) os = "Android";
  else if (/linux/i.test(uaString)) os = "Linux";

  // Resolve Browser
  let browser = "Unknown Browser";
  if (/opr\/|opera/i.test(uaString)) browser = "Opera";
  else if (/edg/i.test(uaString)) browser = "Edge";
  else if (/chrome/i.test(uaString)) browser = "Chrome";
  else if (/safari/i.test(uaString)) browser = "Safari";
  else if (/firefox/i.test(uaString)) browser = "Firefox";
  else if (/msie|trident/i.test(uaString)) browser = "Internet Explorer";

  return `${browser} on ${os}`;
}

export async function recordLoginEvent(
  userId: string,
  provider: string,
  ip: string,
  userAgentString: string,
): Promise<void> {
  try {
    const device = parseUserAgent(userAgentString);
    let ipAddress = ip || "unknown";
    if (ipAddress === "::1" || ipAddress === "::ffff:127.0.0.1") {
      ipAddress = "127.0.0.1";
    }

    await LoginLog.create({
      userId,
      provider,
      ip: ipAddress,
      userAgent: device,
      loggedAt: new Date(),
    });

    await recordSecurityEvent(
      userId,
      "login",
      ipAddress,
      device,
      `Logged in via ${provider}`,
    );
  } catch (err) {
    console.error("[recordLoginEvent] Error:", err);
  }
}

export async function login(
  email: string | undefined,
  password: string,
  tenantId?: string,
  username?: string,
): Promise<
  | AuthResult
  | TwoFactorRequiredResult
  | DeletionScheduledResult
  | PasswordResetRequiredResult
> {
  let user;
  if (tenantId && username) {
    user = await User.findOne({
      tenantId: tenantId.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
    });
  } else if (email) {
    user = await User.findOne({
      email: email.toLowerCase().trim(),
      username: null,
    });
  } else {
    throw new Error("Invalid login payload");
  }

  if (!user) throw new Error("Invalid email, username, or password");

  // OAuth-only users have no password — they must use social login
  if (!user.passwordHash) {
    throw new Error(
      "This account uses social login. Please sign in with Google or GitHub.",
    );
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new Error("Invalid email, username, or password");

  if (user.accountLocked) {
    throw new Error(
      "This account has been permanently deactivated and cannot be accessed.",
    );
  }

  if (user.requiresPasswordReset) {
    return {
      requiresPasswordReset: true,
      userId: user._id.toString(),
      message: "First login detected. You must change your password.",
    };
  }

  if (user.twoFactorEnabled) {
    if (user.twoFactorMethod === "totp" && user.twoFactorTotpSecret) {
      return {
        requires2fa: true,
        email: user.email || "",
        userId: user._id.toString(),
        method: "totp",
        message:
          "Enter the code from your authenticator app to finish signing in.",
      };
    }

    // Email OTP is only supported for root/email accounts
    if (!user.email || user.username) {
      throw new Error(
        "Mismatched 2FA method: Only Authenticator App 2FA is supported for team members.",
      );
    }

    const otpResult = await sendOtp(user.email, "login-2fa", user.name);
    if (!otpResult.success) {
      const error = new Error(otpResult.message);
      (error as any).status = 429;
      (error as any).resendAfterSecs = otpResult.resendAfterSecs;
      throw error;
    }

    return {
      requires2fa: true,
      email: user.email,
      userId: user._id.toString(),
      method: "email",
      message: "Security code sent. Check your email to finish signing in.",
      resendAfterSecs: otpResult.resendAfterSecs,
    };
  }

  return { token: generateToken(user), user: formatUser(user) };
}

export async function verifyLogin2fa(
  identifier: string,
  code: string,
): Promise<AuthResult> {
  const normalizedIdentifier = identifier.toLowerCase().trim();
  let user;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    user = await User.findById(identifier);
  } else {
    user = await User.findOne({ email: normalizedIdentifier });
  }

  if (!user || !user.twoFactorEnabled) {
    throw new Error("Invalid two-factor verification request");
  }

  if (user.twoFactorMethod === "totp" && user.twoFactorTotpSecret) {
    const valid = verifyTotp(decryptKey(user.twoFactorTotpSecret), code);
    if (!valid) throw new Error("Invalid authenticator code.");
  } else {
    const otpResult = await verifyOtp(normalizedIdentifier, code, "login-2fa");
    if (!otpResult.valid) throw new Error(otpResult.message);
  }

  return { token: generateToken(user), user: formatUser(user) };
}

export async function resendLogin2fa(email: string): Promise<OtpStartResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.twoFactorEnabled) {
    throw new Error("Invalid two-factor verification request");
  }
  if (user.twoFactorMethod === "totp" && user.twoFactorTotpSecret) {
    throw new Error("Use your authenticator app code for this account.");
  }
  if (!user.email || user.username) {
    throw new Error("Email OTP is not supported for this account.");
  }

  const otpResult = await sendOtp(normalizedEmail, "login-2fa", user.name);
  if (!otpResult.success) {
    const error = new Error(otpResult.message);
    (error as any).status = 429;
    (error as any).resendAfterSecs = otpResult.resendAfterSecs;
    throw error;
  }

  return {
    email: normalizedEmail,
    message: "Security code sent. Check your email to finish signing in.",
    resendAfterSecs: otpResult.resendAfterSecs,
  };
}
