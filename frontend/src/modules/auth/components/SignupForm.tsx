"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSignup } from "../hooks/useSignup";
import { useAuth } from "@/context/AuthContext";

interface SignupFormProps {
  onSuccess?: (email: string) => void;
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const { oauthLogin } = useAuth();
  const { isLoading, error, signup } = useSignup();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  const errorMsg = error || localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (password.length < 6) { setLocalError("Password must be at least 6 characters"); return; }
    try {
      await signup(email, name, password);
      onSuccess?.(email);
      router.push(`/verify-signup?email=${encodeURIComponent(email.trim())}`);
    } catch { /* handled by hook */ }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setLocalError("");
    try { await oauthLogin(provider); } catch (err: any) { setLocalError(err.message); setOauthLoading(null); }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#0F172A]">Sign Up</h1>
        <p className="text-[14px] mt-2 text-[#475569]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#1A56DB] font-bold hover:underline">Sign in.</Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && <div className="p-3.5 bg-red-50 text-red-700 border border-red-100 rounded-xl text-sm font-semibold">{errorMsg}</div>}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[13px] font-bold text-[#334155]">Full Name</Label>
          <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Enter your name" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[13px] font-bold text-[#334155]">Email Address</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter email address" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-[13px] font-bold text-[#334155]">Password</Label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] text-white hover:opacity-90 font-bold mt-4 shadow-[0_8px_20px_-6px_rgba(26,86,219,0.4)]">{isLoading ? "Creating account..." : "Continue"}</Button>
      </form>

      <div className="relative mt-8 mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E2E8F0]" /></div>
        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[0.16em]"><span className="bg-white px-3 text-[#94A3B8]">OR</span></div>
      </div>

      <div className="grid gap-3">
        {(["github", "google"] as const).map((provider) => (
          <button key={provider} type="button" disabled={!!oauthLoading} onClick={() => handleOAuth(provider)}
            className="flex items-center justify-center gap-3 w-full h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] font-bold text-sm hover:bg-white hover:border-[#CBD5E1] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all disabled:opacity-60">
            {oauthLoading === provider ? <div className={`w-4 h-4 rounded-full border-2 border-[#CBD5E1] border-t-[${provider === "google" ? "#4285F4" : "#334155"}] animate-spin`} /> : null}
            Sign up with {provider === "github" ? "GitHub" : "Google"}
          </button>
        ))}
      </div>
    </>
  );
}
