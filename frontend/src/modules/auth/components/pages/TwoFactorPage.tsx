"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { z } from "zod";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { authFetchJson } from "@/lib/auth-fetch";

const ResendEnvelopeSchema = z.object({
  success: z.boolean(),
  email: z.string().optional(),
  message: z.string().optional(),
  resendAfterSecs: z.number().optional(),
});

function Login2faForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { verifyLogin2fa } = useAuth();
  const [email, setEmail] = useState(params.get("email") || "");
  const userId = params.get("userId") || "";
  const method = params.get("method") === "totp" ? "totp" : "email";
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(
    params.get("message") ||
      (method === "totp"
        ? "Enter the code from your authenticator app."
        : "Enter the security code sent to your email."),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const sanitized = code.replace(/\D/g, "");
    if (sanitized.length !== 6) {
      setError("Enter the 6 digit security code.");
      return;
    }

    setLoading(true);
    try {
      await verifyLogin2fa(email, sanitized, userId || undefined);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to verify security code.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setMessage("");
    setResending(true);
    try {
      if (method === "totp") {
        setError("Use your authenticator app for this account.");
        return;
      }
      const data = await authFetchJson(
        "/api/auth/login/2fa/resend",
        ResendEnvelopeSchema,
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setMessage(data.message || "Security code sent again.");
    } catch (err: any) {
      setError(err.message || "Failed to resend security code.");
    } finally {
      setResending(false);
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
            <h1 className="text-3xl font-black tracking-normal text-[#0F172A]">
              Two-factor authentication
            </h1>
            <p className="mt-4 text-[15px] leading-7 font-semibold text-[#475569]">
              This account requires{" "}
              {method === "totp"
                ? "an authenticator app code"
                : "an email security code"}{" "}
              after password verification. Codes expire quickly and can be used
              once.
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
                <h2 className="text-[28px] font-extrabold tracking-tight text-[#0F172A]">
                  Enter security code
                </h2>
                <p className="mt-2 text-[14px] text-[#475569]">
                  {method === "totp"
                    ? "Open your authenticator app and enter the current 6 digit code."
                    : "We sent a 6 digit code to your email."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {message ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-sm font-semibold text-blue-700">
                    {message}
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                ) : null}

                {method === "email" && (
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
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px]"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label
                    htmlFor="code"
                    className="text-[13px] font-bold text-[#334155]"
                  >
                    Security code
                  </Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                    placeholder="******"
                    className="h-12 rounded-xl border-[#CBD5E1] text-center text-lg font-extrabold tracking-[0.4em]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] text-white hover:opacity-90 font-bold shadow-[0_8px_20px_-6px_rgba(26,86,219,0.4)]"
                >
                  {loading ? "Verifying..." : "Verify and continue"}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={method === "totp" || resending || !email}
                  className="font-bold text-[#1A56DB] disabled:opacity-50"
                >
                  {resending ? "Sending..." : "Resend code"}
                </button>
                <Link
                  href="/login"
                  className="font-semibold text-[#64748B] hover:text-[#1A56DB]"
                >
                  Back to login
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function Login2faPage() {
  return (
    <Suspense fallback={null}>
      <Login2faForm />
    </Suspense>
  );
}
