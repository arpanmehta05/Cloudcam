"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { authFetchJson } from "@/lib/auth-fetch";
import {
  ProfileEnvelopeSchema,
  TotpSetupEnvelopeSchema,
} from "./shared";

export function useSecurityTabState() {
  const { user, refreshUser } = useAuth();
  const isReadOnlyUser =
    user?.permissionLevel === "viewer" || user?.permissionLevel === "operator";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordOtp, setPasswordOtp] = useState("");
  const [requiresPasswordOtp, setRequiresPasswordOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [twoFactorMessage, setTwoFactorMessage] = useState<string | null>(null);
  const [savingTwoFactor, setSavingTwoFactor] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUrl, setTotpUrl] = useState("");
  const [totpQrCode, setTotpQrCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [settingUpTotp, setSettingUpTotp] = useState(false);

  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [loadingSecurityEvents, setLoadingSecurityEvents] = useState(false);

  const fetchSecurityEvents = useCallback(async () => {
    if (!user) return;
    setLoadingSecurityEvents(true);
    try {
      const data = await authFetchJson(
        "/api/auth/security-events",
        z.object({
          success: z.boolean(),
          events: z.array(
            z.object({
              _id: z.string(),
              action: z.string(),
              ip: z.string(),
              userAgent: z.string(),
              details: z.string().optional(),
              createdAt: z.string(),
            })
          ),
        })
      );
      setSecurityEvents(data.events);
    } catch (err: any) {
      console.error("Failed to fetch security events:", err);
    } finally {
      setLoadingSecurityEvents(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSecurityEvents();
  }, [fetchSecurityEvents]);

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPasswordMessage(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const payload: any = { password };
      if (requiresPasswordOtp) {
        payload.otpCode = passwordOtp;
      }
      const data = await authFetchJson(
        "/api/auth/set-password",
        z.object({
          success: z.boolean(),
          requiresOtp: z.boolean().optional(),
          message: z.string().optional(),
        }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (data.requiresOtp) {
        setRequiresPasswordOtp(true);
        setPasswordMessage(
          data.message ||
            "Enter the verification code sent to your email to complete password change."
        );
      } else {
        await refreshUser();
        setPassword("");
        setConfirmPassword("");
        setPasswordOtp("");
        setRequiresPasswordOtp(false);
        setPasswordMessage(
          data.message ||
            (user?.hasPassword
              ? "Password updated."
              : "Password enabled for this account.")
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleTwoFactor = async () => {
    setError(null);
    setTwoFactorMessage(null);
    setSavingTwoFactor(true);
    try {
      const enabled = !user?.twoFactorEnabled;
      const data = await authFetchJson(
        "/api/auth/2fa",
        ProfileEnvelopeSchema.extend({
          message: z.string().optional(),
        }),
        {
          method: "PATCH",
          body: JSON.stringify({ enabled }),
        }
      );
      await refreshUser();
      setTwoFactorMessage(
        data.message ||
          (enabled
            ? "Email two-factor authentication is enabled."
            : "Two-factor authentication is disabled.")
      );
    } catch (err: any) {
      setError(err.message || "Failed to update two-factor authentication.");
    } finally {
      setSavingTwoFactor(false);
    }
  };

  const beginAuthenticatorSetup = async () => {
    setError(null);
    setTwoFactorMessage(null);
    setSettingUpTotp(true);
    try {
      const data = await authFetchJson(
        "/api/auth/2fa/totp/setup",
        TotpSetupEnvelopeSchema,
        {
          method: "POST",
        }
      );
      setTotpSecret(data.secret);
      setTotpUrl(data.otpauthUrl);
      setTotpQrCode(data.qrCodeDataUrl);
      setTwoFactorMessage(
        "Scan the QR code or enter the key manually into your authenticator app."
      );
    } catch (err: any) {
      setError(err.message || "Failed to start authenticator setup.");
    } finally {
      setSettingUpTotp(false);
    }
  };

  const confirmAuthenticatorSetup = async () => {
    setError(null);
    setTwoFactorMessage(null);
    setSettingUpTotp(true);
    try {
      const data = await authFetchJson(
        "/api/auth/2fa/totp/confirm",
        ProfileEnvelopeSchema.extend({
          message: z.string().optional(),
        }),
        {
          method: "POST",
          body: JSON.stringify({ code: totpCode }),
        }
      );
      await refreshUser();
      setTotpCode("");
      setTotpSecret("");
      setTotpUrl("");
      setTotpQrCode("");
      setTwoFactorMessage(
        data.message ||
          "Authenticator app two-factor authentication is enabled."
      );
    } catch (err: any) {
      setError(err.message || "Failed to confirm authenticator setup.");
    } finally {
      setSettingUpTotp(false);
    }
  };

  const removeAuthenticatorSetup = async () => {
    setError(null);
    setTwoFactorMessage(null);
    setSettingUpTotp(true);
    try {
      const data = await authFetchJson(
        "/api/auth/2fa/totp",
        ProfileEnvelopeSchema.extend({
          message: z.string().optional(),
        }),
        {
          method: "DELETE",
        }
      );
      await refreshUser();
      setTotpQrCode("");
      setTwoFactorMessage(
        data.message ||
          "Authenticator app two-factor authentication is removed."
      );
    } catch (err: any) {
      setError(err.message || "Failed to remove authenticator setup.");
    } finally {
      setSettingUpTotp(false);
    }
  };

  return {
    user,
    isReadOnlyUser,
    password,
    confirmPassword,
    savingPassword,
    passwordMessage,
    passwordOtp,
    requiresPasswordOtp,
    error,
    twoFactorMessage,
    savingTwoFactor,
    totpSecret,
    totpUrl,
    totpQrCode,
    totpCode,
    settingUpTotp,
    securityEvents,
    loadingSecurityEvents,
    fetchSecurityEvents,
    savePassword,
    toggleTwoFactor,
    beginAuthenticatorSetup,
    confirmAuthenticatorSetup,
    removeAuthenticatorSetup,
    setPassword,
    setConfirmPassword,
    setPasswordOtp,
    setRequiresPasswordOtp,
    setPasswordMessage,
    setTwoFactorMessage,
    setTotpSecret,
    setTotpUrl,
    setTotpQrCode,
    setTotpCode,
  };
}
