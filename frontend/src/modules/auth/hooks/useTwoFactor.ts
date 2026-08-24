"use client";

import { useState } from "react";
import { verifyLogin2fa, forgotPassword, verifyForgotPasswordOtp, type AuthSession } from "../api/auth.api";

export function useTwoFactor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Verify 2FA code after initial login. Returns a full auth session. */
  const verifyTwoFactor = async (
    email: string,
    code: string,
    userId?: string,
  ): Promise<AuthSession> => {
    setIsLoading(true);
    setError(null);
    try {
      return await verifyLogin2fa(email, code, userId);
    } catch (err: any) {
      setError(err.message || "2FA verification failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /** Request a password reset OTP via email. */
  const requestPasswordReset = async (
    email: string,
  ): Promise<{ email: string; message: string; resendAfterSecs?: number }> => {
    setIsLoading(true);
    setError(null);
    try {
      return await forgotPassword(email);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /** Verify the forgot-password OTP and get a reset token. */
  const verifyPasswordResetOtp = async (
    email: string,
    code: string,
  ): Promise<{ resetToken: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      return await verifyForgotPasswordOtp(email, code);
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    isLoading,
    error,
    verifyTwoFactor,
    requestPasswordReset,
    verifyPasswordResetOtp,
    clearError,
  };
}
