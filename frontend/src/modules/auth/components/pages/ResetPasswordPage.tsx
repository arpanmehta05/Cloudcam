"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { z } from "zod";
import { authFetchJson } from "@/lib/auth-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";

const ResetPasswordSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const Feature = ({ title, desc }: { title: string; desc: string }) => (
  <div className="flex gap-4 mb-8">
    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A56DB] text-white shadow-md shadow-[#1A56DB]/30">
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
    <div>
      <h3 className="text-[15px] font-extrabold text-[#0F172A]">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[#475569]">
        {desc}
      </p>
    </div>
  </div>
);

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email) return;
    const stored = sessionStorage.getItem(
      `rabbittize_reset_${email.toLowerCase().trim()}`,
    );
    if (stored) setResetToken(stored);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!resetToken) {
      setError("Verify your email before setting a new password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authFetchJson("/api/auth/reset-password", ResetPasswordSchema, {
        method: "POST",
        body: JSON.stringify({ email, resetToken, newPassword: password }),
      });
      sessionStorage.removeItem(
        `rabbittize_reset_${email.toLowerCase().trim()}`,
      );
      router.push("/login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex relative font-sans overflow-hidden">
      <div className="absolute inset-0 z-0 flex pointer-events-none">
        <div className="w-full md:w-[50%] bg-[#F8FAFC] h-full" />
        <div
          className="hidden md:block w-[70%] h-full absolute right-0 top-0 bottom-0"
          style={{ clipPath: "polygon(15% 0, 100% 0, 100% 100%, 0% 100%)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A56DB] via-[#3B82F6] to-[#06B6D4] opacity-95" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row w-full z-10 max-w-[1600px] mx-auto min-h-screen">
        <div className="w-full md:w-[55%] flex flex-col justify-center px-8 py-12 md:px-12 lg:px-20 xl:px-28 bg-white/40 md:bg-transparent backdrop-blur-3xl md:backdrop-blur-none">
          <BrandMark className="mb-12" logoClassName="h-10 w-10" />

          <div className="max-w-md">
            <Feature
              title="Create a stronger password"
              desc="Use a password you have not used elsewhere and keep it private to your account."
            />
            <Feature
              title="Confirmed reset session"
              desc="This page is unlocked only after OTP verification, so password changes stay protected."
            />
            <Feature
              title="Return to sign in"
              desc="After saving the new password, sign in again and continue monitoring your AWS and AI spend."
            />
          </div>

          <div className="mt-10 hidden max-w-[440px] rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:block">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.16em] text-[#94A3B8]">
              New credentials
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#475569]">
              Once updated, your old password stops working immediately. Use the
              new password on your next login.
            </p>
          </div>
        </div>

        <div className="w-full md:w-[45%] flex flex-col justify-center items-center px-6 py-12 md:pr-12 lg:pr-20 xl:pr-32 relative">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-[440px]"
          >
            <div className="bg-white rounded-[24px] shadow-[0_32px_64px_-12px_rgba(26,86,219,0.25)] border border-white/50 p-8 sm:p-10 relative z-20">
              <div className="mb-8">
                <h1 className="text-[28px] font-extrabold tracking-tight text-[#0F172A]">
                  Create new password
                </h1>
                <p className="mt-2 text-[14px] text-[#475569]">
                  Choose a new password and confirm it before returning to sign
                  in.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-[13px] font-bold text-[#334155]"
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-[13px] font-bold text-[#334155]"
                  >
                    New Password
                  </Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-[13px] font-bold text-[#334155]"
                  >
                    Confirm Password
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Re-enter new password"
                    className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] text-white hover:opacity-90 font-bold shadow-[0_8px_20px_-6px_rgba(26,86,219,0.4)]"
                >
                  {loading ? "Updating..." : "Update password"}
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
