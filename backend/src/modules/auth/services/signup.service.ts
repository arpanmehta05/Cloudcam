import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import { PendingSignup } from "../../../models/pending-signup.model";
import { Subscription } from "../../../models/subscription.model";
import { sendOtp, verifyOtp } from "../../../services/otp.service";
import { generateToken } from "./jwt.service";
import { formatUser } from "./format";
import { OtpStartResult, AuthResult } from "./login.service";

const PENDING_SIGNUP_EXPIRY_MINS = 15;

export async function signup(
  email: string,
  name: string,
  password: string,
): Promise<OtpStartResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = name.trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new Error("Email already registered");

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const expiresAt = new Date(
    Date.now() + PENDING_SIGNUP_EXPIRY_MINS * 60 * 1000,
  );

  await PendingSignup.findOneAndUpdate(
    { email: normalizedEmail },
    { email: normalizedEmail, name: normalizedName, passwordHash, expiresAt },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  const otpResult = await sendOtp(
    normalizedEmail,
    "email-verify",
    normalizedName,
  );
  if (!otpResult.success) {
    const error = new Error(otpResult.message);
    (error as any).status = 429;
    (error as any).resendAfterSecs = otpResult.resendAfterSecs;
    throw error;
  }

  return {
    email: normalizedEmail,
    message: "Verification code sent. Check your inbox.",
  };
}

export async function verifySignup(
  email: string,
  code: string,
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const otpResult = await verifyOtp(normalizedEmail, code, "email-verify");
  if (!otpResult.valid) throw new Error(otpResult.message);

  const pending = await PendingSignup.findOne({ email: normalizedEmail });
  if (!pending || pending.expiresAt < new Date()) {
    if (pending) await pending.deleteOne();
    throw new Error("Signup session expired. Please sign up again.");
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    await pending.deleteOne();
    throw new Error("Email already registered");
  }

  const user = await User.create({
    email: pending.email,
    name: pending.name,
    passwordHash: pending.passwordHash,
    permissionLevel: "admin",
    username: null,
  });
  const defaultWorkspaceId = user._id.toString();
  user.tenantId = defaultWorkspaceId;
  user.defaultWorkspaceId = defaultWorkspaceId;
  user.workspaces = [defaultWorkspaceId];
  await user.save();
  await Subscription.create({ tenantId: defaultWorkspaceId, planKey: "free" });
  await pending.deleteOne();

  return { token: generateToken(user), user: formatUser(user) };
}
