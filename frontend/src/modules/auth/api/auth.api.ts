/**
 * Auth API Layer — pure async functions, zero React.
 * All auth-related network calls live here.
 * Callers (hooks, AuthContext) import from this file; they own state and side effects.
 */
import { z } from "zod";
import { authFetchJson } from "@/lib/auth-fetch";
import { startOAuthFlow } from "@/lib/oauth";

// ─── Shared Schemas ─────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  name: z.string(),
  provider: z.enum(["email", "google", "github"]).optional(),
  avatarUrl: z.string().nullable().optional(),
  permissionLevel: z.enum(["viewer", "operator", "admin"]).optional(),
  isSystemAdmin: z.boolean().optional(),
  hasPassword: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  twoFactorMethod: z.enum(["email", "totp"]).optional(),
  twoFactorAuthenticatorConfigured: z.boolean().optional(),
  tenantId: z.string().optional(),
  defaultWorkspaceId: z.string().optional(),
  workspaces: z.array(z.string()).optional(),
  pinnedServices: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  awsConnected: z.boolean(),
  azureConnected: z.boolean().optional(),
  gcpConnected: z.boolean().optional(),
  githubConnected: z.boolean().optional(),
  awsCredentials: z.object({
    roleArn: z.string(),
    externalId: z.string(),
    connectedAt: z.string(),
  }).nullable().optional(),
  usageReportPreferences: z.object({
    enabled: z.boolean(),
    frequency: z.enum(["weekly", "monthly"]),
    lastSentAt: z.string().nullable().optional(),
    nextSendAt: z.string().nullable().optional(),
  }).optional(),
  recentLogins: z.array(z.object({
    provider: z.string(),
    ip: z.string(),
    userAgent: z.string(),
    loggedAt: z.string(),
    user: z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      email: z.string().nullable().optional(),
      username: z.string().nullable().optional(),
    }).nullable().optional(),
  })).optional(),
});

export type User = z.infer<typeof UserSchema>;

const AuthEnvelopeSchema = z.object({
  success: z.boolean(),
  token: z.string(),
  user: UserSchema,
});

const LoginEnvelopeSchema = z.object({
  success: z.boolean(),
  token: z.string().optional(),
  user: UserSchema.optional(),
  requires2fa: z.boolean().optional(),
  email: z.string().optional(),
  userId: z.string().optional(),
  method: z.enum(["email", "totp"]).optional(),
  message: z.string().optional(),
  requiresPasswordReset: z.boolean().optional(),
  deletionScheduled: z.boolean().optional(),
  scheduledDeletionAt: z.string().optional(),
});

const OtpStartEnvelopeSchema = z.object({
  success: z.boolean(),
  email: z.string(),
  message: z.string(),
  resendAfterSecs: z.number().optional(),
});

const MeEnvelopeSchema = z.object({
  success: z.boolean(),
  user: UserSchema,
});

// ─── Public Types ────────────────────────────────────────────────────────────

export type LoginResult = {
  requires2fa?: boolean;
  email?: string;
  userId?: string;
  method?: "email" | "totp";
  message?: string;
  requiresPasswordReset?: boolean;
  deletionScheduled?: boolean;
  scheduledDeletionAt?: string;
  token?: string;
  user?: User;
};

export type AuthSession = { token: string; user: User };

// ─── API Functions ───────────────────────────────────────────────────────────

/** Fetch the current user using a stored token. Throws on failure. */
export async function fetchCurrentUser(token: string): Promise<User> {
  const data = await authFetchJson("/api/auth/me", MeEnvelopeSchema, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.user;
}

/** Login with email/password or team credentials. Returns login result (may require 2FA). */
export async function loginUser(
  email: string | undefined,
  password: string,
  tenantId?: string,
  username?: string,
): Promise<LoginResult> {
  const data = await authFetchJson("/api/auth/login", LoginEnvelopeSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, tenantId, username }),
  });
  return data;
}

/** Complete 2FA verification and return a full auth session. */
export async function verifyLogin2fa(
  email: string,
  code: string,
  userId?: string,
): Promise<AuthSession> {
  const data = await authFetchJson("/api/auth/login/2fa", AuthEnvelopeSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, userId }),
  });
  return { token: data.token, user: data.user };
}

/** Register a new account. Returns OTP envelope (no session yet). */
export async function signupUser(
  email: string,
  name: string,
  password: string,
): Promise<{ email: string; message: string }> {
  const data = await authFetchJson("/api/auth/signup", OtpStartEnvelopeSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  return { email: data.email, message: data.message };
}

/** Verify signup OTP and return a full auth session. */
export async function verifySignupOtp(
  email: string,
  code: string,
): Promise<AuthSession> {
  const data = await authFetchJson("/api/auth/signup/verify", AuthEnvelopeSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return { token: data.token, user: data.user };
}

/** First-login password reset. Returns a full auth session. */
export async function resetPasswordFirstLogin(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthSession> {
  const data = await authFetchJson(
    "/api/auth/reset-password-first-login",
    AuthEnvelopeSchema,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, currentPassword, newPassword }),
    },
  );
  return { token: data.token, user: data.user };
}

/** Restore a soft-deleted account. Returns a full auth session. */
export async function restoreAccount(
  userId: string,
  password: string,
): Promise<AuthSession> {
  const data = await authFetchJson("/api/auth/restore-account", AuthEnvelopeSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  return { token: data.token, user: data.user };
}

/** Initiate OAuth flow (redirects browser). */
export async function oauthLogin(provider: "google" | "github"): Promise<void> {
  await startOAuthFlow(provider);
}

/** Update pinned services on the user profile. Returns updated user. */
export async function updatePinnedServices(pinnedServices: string[]): Promise<User> {
  const data = await authFetchJson(
    "/api/auth/profile",
    z.object({ success: z.boolean(), user: UserSchema }),
    {
      method: "PATCH",
      body: JSON.stringify({ pinnedServices }),
    },
  );
  return data.user;
}

/** Request a forgot-password OTP. */
export async function forgotPassword(
  email: string,
): Promise<{ email: string; message: string; resendAfterSecs?: number }> {
  const StartResetSchema = z.object({
    success: z.boolean(),
    email: z.string(),
    message: z.string(),
    resendAfterSecs: z.number().optional(),
  });
  const data = await authFetchJson("/api/auth/forgot-password", StartResetSchema, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return { email: data.email, message: data.message, resendAfterSecs: data.resendAfterSecs };
}

/** Verify a forgot-password OTP and return a reset token. */
export async function verifyForgotPasswordOtp(
  email: string,
  code: string,
): Promise<{ resetToken: string }> {
  const VerifyResetSchema = z.object({
    success: z.boolean(),
    resetToken: z.string(),
    message: z.string(),
  });
  const data = await authFetchJson("/api/auth/forgot-password/verify", VerifyResetSchema, {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  return { resetToken: data.resetToken };
}
