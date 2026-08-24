// ─── Team Service: Team member business logic ───
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User, type PermissionLevel } from "../../../models/user.model";
import { logger } from "../../../core/logger";

export async function getTeamMembers(userId: string) {
    const currentUser = await User.findById(userId);
    if (!currentUser) throw new Error("User not found");

    const tenantId = currentUser.tenantId || currentUser._id.toString();
    const members = await User.find({ tenantId })
        .select("name email username provider permissionLevel createdAt")
        .sort({ createdAt: 1 })
        .lean();

    return members;
}

export async function createTeamUser(
    requestingUserId: string,
    payload: { name?: string; username?: string; email?: string; role?: PermissionLevel }
) {
    const { name, username, role, email } = payload;
    if (!name || !username || !role) throw new Error("Name, username, and role are required");

    const normalizedUsername = username.toLowerCase().trim();
    if (!/^[a-zA-Z0-9.]+$/.test(normalizedUsername)) {
        throw new Error("Username must be alphanumeric and may contain dots only (e.g. alex.ops)");
    }

    const currentUser = await User.findById(requestingUserId);
    if (!currentUser) throw new Error("User not found");

    const tenantId = currentUser.tenantId || currentUser._id.toString();

    const existingUsername = await User.findOne({ tenantId, username: normalizedUsername });
    if (existingUsername) throw new Error("Username is already taken within this workspace");

    const normalizedEmail = email && email.trim() ? email.toLowerCase().trim() : null;
    const tempPassword = `rabbitt-${crypto.randomBytes(4).toString("hex")}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const newUser = await User.create({
        name: name.trim(),
        username: normalizedUsername,
        email: normalizedEmail,
        provider: "email",
        permissionLevel: role,
        tenantId,
        passwordHash,
        requiresPasswordReset: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    return { id: newUser._id.toString(), name: newUser.name, username: newUser.username, email: newUser.email, role: newUser.permissionLevel, tenantId: newUser.tenantId, tempPassword };
}

export async function deleteTeamUser(requestingUserId: string, targetUserId: string) {
    if (targetUserId === requestingUserId) throw new Error("You cannot revoke your own access");

    const currentUser = await User.findById(requestingUserId);
    if (!currentUser) throw new Error("User not found");

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new Error("Target user not found");

    const tenantId = currentUser.tenantId || currentUser._id.toString();
    if (targetUser.tenantId !== tenantId) throw new Error("You are not authorized to manage this user");

    await targetUser.deleteOne();
    return { message: "User access revoked successfully" };
}

export async function updateTeamUser(
    requestingUserId: string,
    targetUserId: string,
    payload: { name?: string; email?: string; role?: PermissionLevel; password?: string }
) {
    const { name, email, role, password } = payload;
    if (!name || !role) throw new Error("Name and role are required");

    const currentUser = await User.findById(requestingUserId);
    if (!currentUser) throw new Error("User not found");

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new Error("Target user not found");

    const tenantId = currentUser.tenantId || currentUser._id.toString();
    if (targetUser.tenantId !== tenantId) throw new Error("You are not authorized to manage this user");
    if (targetUserId === requestingUserId && role !== "admin") throw new Error("You cannot change your own admin role");

    const normalizedEmail = email && email.trim() ? email.toLowerCase().trim() : null;
    targetUser.name = name.trim();
    targetUser.email = normalizedEmail;
    targetUser.permissionLevel = role;

    let tempPassword: string | undefined;
    if (password && password.trim()) {
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        targetUser.passwordHash = await bcrypt.hash(password, 12);
        targetUser.requiresPasswordReset = true;
        tempPassword = password;
    }

    targetUser.updatedAt = new Date();
    await targetUser.save();

    return { id: targetUser._id.toString(), name: targetUser.name, username: targetUser.username, email: targetUser.email, role: targetUser.permissionLevel, tenantId: targetUser.tenantId, tempPassword };
}

export async function resetTeamUserPassword(requestingUserId: string, targetUserId: string) {
    const currentUser = await User.findById(requestingUserId);
    if (!currentUser) throw new Error("User not found");

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new Error("Target user not found");

    const tenantId = currentUser.tenantId || currentUser._id.toString();
    if (targetUser.tenantId !== tenantId) throw new Error("You are not authorized to manage this user");

    const tempPassword = `rabbitt-${crypto.randomBytes(4).toString("hex")}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    targetUser.passwordHash = passwordHash;
    targetUser.requiresPasswordReset = true;
    targetUser.updatedAt = new Date();
    await targetUser.save();

    return { id: targetUser._id.toString(), name: targetUser.name, username: targetUser.username, email: targetUser.email, role: targetUser.permissionLevel, tenantId: targetUser.tenantId, tempPassword };
}
