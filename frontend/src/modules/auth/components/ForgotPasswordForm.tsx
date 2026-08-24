"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTwoFactor } from "../hooks/useTwoFactor";

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const params = useSearchParams();
  const router = useRouter();
  const { isLoading, error, requestPasswordReset, verifyPasswordResetOtp } = useTwoFactor();

  const [step, setStep] = useState<"email" | "verify">(params.get("email") ? "verify" : "email");
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const [resendAfter, setResendAfter] = useState(0);

  const errorMsg = error || localError;

  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = window.setInterval(() => setResendAfter((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendAfter]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLocalError("");
    try {
      const result = await requestPasswordReset(email);
      setEmail(result.email);
      setMessage(result.message);
      setResendAfter(result.resendAfterSecs || 0);
      setStep("verify");
    } catch { /* handled by hook */ }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    const sanitized = code.replace(/\D/g, "");
    if (sanitized.length !== 6) { setLocalError("Enter the 6 digit OTP from your email."); return; }
    try {
      const { resetToken } = await verifyPasswordResetOtp(email, sanitized);
      sessionStorage.setItem(`rabbittize_reset_${email.toLowerCase().trim()}`, resetToken);
      onSuccess?.();
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch { /* handled by hook */ }
  };

  return (
    <div className="bg-white rounded-[24px] shadow-[0_32px_64px_-12px_rgba(26,86,219,0.25)] border border-white/50 p-8 sm:p-10 relative z-20 w-full max-w-[440px]">
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#0F172A]">Forgot password?</h1>
        <p className="mt-2 text-[14px] text-[#475569]">{step === "email" ? "Enter your email first. We will send a 6 digit OTP." : "Now enter the OTP from your email to continue."}</p>
      </div>

      {message && <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-sm font-semibold text-blue-700">{message}</div>}
      {errorMsg && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-semibold text-red-700">{errorMsg}</div>}

      {step === "email" ? (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-bold text-[#334155]">Email Address</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px]" />
          </div>
          <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] text-white hover:opacity-90 font-bold shadow-[0_8px_20px_-6px_rgba(26,86,219,0.4)]">{isLoading ? "Sending OTP..." : "Send OTP"}</Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-[13px] font-bold text-[#334155]">Code</Label>
            <Input id="code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required placeholder="******" className="h-12 rounded-xl border-[#CBD5E1] text-center text-lg font-extrabold tracking-[0.4em]" />
          </div>
          <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] text-white hover:opacity-90 font-bold shadow-[0_8px_20px_-6px_rgba(26,86,219,0.4)]">{isLoading ? "Verifying..." : "Verify OTP"}</Button>
        </form>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        {step === "verify" && (
          <button type="button" onClick={() => handleRequestOtp()} disabled={isLoading || resendAfter > 0} className="font-bold text-[#1A56DB] disabled:opacity-50">
            {resendAfter > 0 ? `Resend in ${resendAfter}s` : "Resend code"}
          </button>
        )}
        <Link href="/login" className="ml-auto font-semibold text-[#64748B] hover:text-[#1A56DB]">Back to sign in</Link>
      </div>
    </div>
  );
}
