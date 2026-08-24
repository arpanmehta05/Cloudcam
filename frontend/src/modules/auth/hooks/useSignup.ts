"use client";

import { useState } from "react";
import { signupUser, verifySignupOtp, type AuthSession } from "../api/auth.api";

export function useSignup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = async (
    email: string,
    name: string,
    password: string,
  ): Promise<{ email: string; message: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      return await signupUser(email, name, password);
    } catch (err: any) {
      setError(err.message || "Signup failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, code: string): Promise<AuthSession> => {
    setIsLoading(true);
    setError(null);
    try {
      return await verifySignupOtp(email, code);
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return { isLoading, error, signup, verifyOtp, clearError };
}
