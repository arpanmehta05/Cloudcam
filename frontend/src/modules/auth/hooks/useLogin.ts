"use client";

import { useState } from "react";
import { loginUser, resetPasswordFirstLogin, restoreAccount, type LoginResult } from "../api/auth.api";

export type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "requires2fa"; email: string; userId?: string; method?: "email" | "totp"; message?: string }
  | { status: "requiresPasswordReset"; userId: string; tempPass: string }
  | { status: "deletionScheduled"; userId: string; pass: string; scheduledAt: string }
  | { status: "success" }
  | { status: "error"; message: string };

export function useLogin() {
  const [state, setState] = useState<LoginState>({ status: "idle" });

  const login = async (
    email: string | undefined,
    password: string,
    tenantId?: string,
    username?: string,
  ): Promise<LoginResult> => {
    setState({ status: "loading" });
    try {
      const result = await loginUser(email, password, tenantId, username);

      if (result.requires2fa) {
        setState({
          status: "requires2fa",
          email: result.email || email || "",
          userId: result.userId,
          method: result.method,
          message: result.message,
        });
        return result;
      }

      if (result.requiresPasswordReset) {
        setState({ status: "requiresPasswordReset", userId: result.userId!, tempPass: password });
        return result;
      }

      if (result.deletionScheduled) {
        setState({
          status: "deletionScheduled",
          userId: result.userId!,
          pass: password,
          scheduledAt: result.scheduledDeletionAt || "",
        });
        return result;
      }

      setState({ status: "success" });
      return result;
    } catch (err: any) {
      setState({ status: "error", message: err.message || "Login failed" });
      throw err;
    }
  };

  const doResetPassword = async (
    userId: string,
    tempPass: string,
    newPassword: string,
  ) => {
    setState({ status: "loading" });
    try {
      const session = await resetPasswordFirstLogin(userId, tempPass, newPassword);
      setState({ status: "success" });
      return session;
    } catch (err: any) {
      setState({ status: "error", message: err.message || "Password reset failed" });
      throw err;
    }
  };

  const doRestoreAccount = async (userId: string, password: string) => {
    setState({ status: "loading" });
    try {
      const session = await restoreAccount(userId, password);
      setState({ status: "success" });
      return session;
    } catch (err: any) {
      setState({ status: "error", message: err.message || "Account restore failed" });
      throw err;
    }
  };

  const reset = () => setState({ status: "idle" });

  return { state, login, doResetPassword, doRestoreAccount, reset };
}
