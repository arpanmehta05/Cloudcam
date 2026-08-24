import mongoose from "mongoose";
import { User } from "../models/user.model";
import { LoginLog } from "../../../models/loginLog.model";
import { formatUser } from "./format";
import { parseUserAgent } from "./login.service";

export async function getMe(userId: string, ip?: string, userAgent?: string) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // Auto-promote tenant owner to admin if they are operator or viewer
  const isOwner = !user.tenantId || user.tenantId === user._id.toString();
  if (isOwner && user.permissionLevel !== "admin") {
    user.permissionLevel = "admin";
    if (!user.tenantId) {
      user.tenantId = user._id.toString();
    }
    await user.save();
  }

  let logsQuery;
  if (user.permissionLevel === "admin" && user.tenantId) {
    const tenantUsers = await User.find({ tenantId: user.tenantId })
      .select("_id")
      .lean();
    const ids = tenantUsers.map((u) => u._id);
    logsQuery = LoginLog.find({ userId: { $in: ids } });
  } else {
    logsQuery = LoginLog.find({ userId: user._id });
  }

  let logs = await logsQuery
    .populate("userId", "name email username")
    .sort({ loggedAt: -1 })
    .limit(10)
    .lean();

  if (logs.length === 0 && (ip || userAgent)) {
    const device = parseUserAgent(userAgent || "");
    let ipAddress = ip || "127.0.0.1";
    if (ipAddress === "::1" || ipAddress === "::ffff:127.0.0.1") {
      ipAddress = "127.0.0.1";
    }
    const initialLog = await LoginLog.create({
      userId: user._id,
      provider: user.provider || "email",
      ip: ipAddress,
      userAgent: device,
      loggedAt: new Date(),
    });
    const initialLogObj = initialLog.toObject
      ? initialLog.toObject()
      : (initialLog as any);
    initialLogObj.userId = {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
    };
    logs = [initialLogObj];
  }

  return formatUser(user, logs);
}

export async function updateProfile(
  userId: string,
  input: { name?: string; pinnedServices?: string[] },
): Promise<ReturnType<typeof formatUser>> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (input.name !== undefined) {
    const name = input.name?.trim();
    if (!name || name.length < 2) {
      throw new Error("Name must be at least 2 characters");
    }
    user.name = name;
  }

  if (Array.isArray(input.pinnedServices)) {
    user.pinnedServices = input.pinnedServices;
  }

  await user.save();
  return formatUser(user);
}

export async function setTwoFactor(
  userId: string,
  enabled: boolean,
): Promise<ReturnType<typeof formatUser>> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (enabled && user.username && !user.twoFactorTotpSecret) {
    throw new Error(
      "Team members can only enable 2FA by setting up an Authenticator App.",
    );
  }

  user.twoFactorEnabled = enabled;
  if (enabled) {
    user.twoFactorMethod = user.twoFactorTotpSecret ? "totp" : "email";
  }
  await user.save();
  return formatUser(user);
}
