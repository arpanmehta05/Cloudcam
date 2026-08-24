"use client";

/**
 * AuthContext — state management only.
 * All API calls are delegated to modules/auth/api/auth.api.ts.
 */
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { clearApiCache } from "@/lib/auth-fetch";
import { startOAuthFlow } from "@/lib/oauth";
import {
  fetchCurrentUser,
  loginUser,
  verifyLogin2fa,
  signupUser,
  verifySignupOtp,
  resetPasswordFirstLogin,
  restoreAccount,
  updatePinnedServices,
  type User,
  type LoginResult,
} from "@/modules/auth/api/auth.api";

export type { User };

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string | undefined, password: string, tenantId?: string, username?: string) => Promise<LoginResult | void>;
  verifyLogin2fa: (email: string, code: string, userId?: string) => Promise<void>;
  resetPasswordFirstLogin: (userId: string, currentPassword: string, newPassword: string) => Promise<void>;
  restoreAccount: (userId: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string) => Promise<void>;
  verifySignup: (email: string, code: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  oauthLogin: (provider: "google" | "github") => Promise<void>;
  setOAuthSession: (token: string, user: User) => void;
  updatePinnedServices?: (pinnedServices: string[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const LOGOUT_REDIRECT_KEY = "rabbittize_post_logout_redirect";
const LOGOUT_LANDING_KEY = "rabbittize_show_landing_after_logout";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem("rabbittize_token");
    if (!stored) { setIsLoading(false); return; }
    try {
      const freshUser = await fetchCurrentUser(stored);
      setUser(freshUser);
      setToken(stored);
    } catch {
      localStorage.removeItem("rabbittize_token");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = async (
    email: string | undefined,
    password: string,
    tenantId?: string,
    username?: string,
  ): Promise<LoginResult | void> => {
    const result = await loginUser(email, password, tenantId, username);
    if (result.requires2fa || result.requiresPasswordReset || result.deletionScheduled) {
      return result;
    }
    if (result.token && result.user) {
      localStorage.setItem("rabbittize_token", result.token);
      setToken(result.token);
      setUser(result.user);
    }
  };

  const doVerifyLogin2fa = async (email: string, code: string, userId?: string) => {
    const session = await verifyLogin2fa(email, code, userId);
    localStorage.setItem("rabbittize_token", session.token);
    setToken(session.token);
    setUser(session.user);
  };

  const signup = async (email: string, name: string, password: string) => {
    await signupUser(email, name, password);
  };

  const verifySignup = async (email: string, code: string) => {
    const session = await verifySignupOtp(email, code);
    localStorage.setItem("rabbittize_token", session.token);
    setToken(session.token);
    setUser(session.user);
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(LOGOUT_REDIRECT_KEY, "/");
      sessionStorage.setItem(LOGOUT_LANDING_KEY, "1");
    }
    clearApiCache();
    localStorage.removeItem("rabbittize_token");
    setToken(null);
    setUser(null);
  };

  const doResetPasswordFirstLogin = async (
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) => {
    const session = await resetPasswordFirstLogin(userId, currentPassword, newPassword);
    localStorage.setItem("rabbittize_token", session.token);
    setToken(session.token);
    setUser(session.user);
  };

  const doRestoreAccount = async (userId: string, password: string) => {
    const session = await restoreAccount(userId, password);
    localStorage.setItem("rabbittize_token", session.token);
    setToken(session.token);
    setUser(session.user);
  };

  const oauthLogin = async (provider: "google" | "github") => {
    await startOAuthFlow(provider);
  };

  const setOAuthSession = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

  const doUpdatePinnedServices = async (pinnedServices: string[]) => {
    const updatedUser = await updatePinnedServices(pinnedServices);
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      login,
      verifyLogin2fa: doVerifyLogin2fa,
      resetPasswordFirstLogin: doResetPasswordFirstLogin,
      restoreAccount: doRestoreAccount,
      signup, verifySignup, logout, refreshUser,
      oauthLogin, setOAuthSession,
      updatePinnedServices: doUpdatePinnedServices,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
