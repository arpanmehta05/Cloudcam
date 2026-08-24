"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DynamicModal } from "@/components/ui/DynamicModal";
import { Github, Google } from "@/icons";
import { useLogin } from "../hooks/useLogin";
import { useAuth } from "@/context/AuthContext";
import { consumePostAuthRedirect } from "@/lib/post-auth-redirect";

type LoginType = "master" | "team";

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { setOAuthSession, oauthLogin } = useAuth();
  const { state, login, doResetPassword, doRestoreAccount, reset } = useLogin();
  const router = useRouter();

  const [loginType, setLoginType] = useState<LoginType>("master");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const isLoading = state.status === "loading";
  const errorMsg = state.status === "error" ? state.message : localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    try {
      const result = await login(
        loginType === "team" ? undefined : email,
        password,
        loginType === "team" ? tenantId : undefined,
        loginType === "team" ? username : undefined,
      );
      if (result.requires2fa) {
        const q = `?email=${encodeURIComponent(result.email || email)}${result.userId ? `&userId=${result.userId}` : ""}${result.method ? `&method=${result.method}` : ""}${result.message ? `&message=${encodeURIComponent(result.message)}` : ""}`;
        router.push(`/login/2fa${q}`);
        return;
      }
      if (!result.requiresPasswordReset && !result.deletionScheduled && result.token && result.user) {
        localStorage.setItem("rabbittize_token", result.token);
        setOAuthSession(result.token, result.user as any);
        onSuccess?.();
        router.replace(consumePostAuthRedirect());
      }
    } catch { /* state already set by hook */ }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (newPassword.length < 6) { setLocalError("Password must be at least 6 characters long."); return; }
    if (newPassword !== confirmPassword) { setLocalError("Passwords do not match."); return; }
    if (state.status !== "requiresPasswordReset") return;
    try {
      const session = await doResetPassword(state.userId, state.tempPass, newPassword);
      localStorage.setItem("rabbittize_token", session.token);
      setOAuthSession(session.token, session.user as any);
      router.replace("/dashboard");
    } catch { /* handled by hook */ }
  };

  const handleRestoreAccount = async () => {
    if (state.status !== "deletionScheduled") return;
    try {
      const session = await doRestoreAccount(state.userId, state.pass);
      localStorage.setItem("rabbittize_token", session.token);
      setOAuthSession(session.token, session.user as any);
      router.replace("/dashboard");
    } catch { reset(); }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setLocalError("");
    try { await oauthLogin(provider); } catch (err: any) { setLocalError(err.message); setOauthLoading(null); }
  };

  if (state.status === "requiresPasswordReset") {
    return (
      <form onSubmit={handleResetSubmit} className="space-y-4">
        <div className="mb-8">
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#0F172A]">Set New Password</h1>
          <p className="text-[14px] mt-2 text-[#475569]">This is your first login. Please choose a new secure password.</p>
        </div>
        {errorMsg && <div className="p-3.5 bg-red-50 text-red-700 border border-red-100 rounded-xl text-sm font-semibold">{errorMsg}</div>}
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-[13px] font-bold text-[#334155]">New Password</Label>
          <PasswordInput id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="••••••••" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-[13px] font-bold text-[#334155]">Confirm New Password</Label>
          <PasswordInput id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] text-white hover:opacity-90 font-bold mt-4 shadow-[0_8px_20px_-6px_rgba(26,86,219,0.4)]">{isLoading ? "Saving..." : "Save and Continue"}</Button>
        <Button type="button" onClick={() => { reset(); setNewPassword(""); setConfirmPassword(""); setLocalError(""); }} className="w-full h-12 rounded-xl border border-slate-200 text-[#64748B] hover:text-[#0F172A] font-bold mt-2 hover:bg-slate-50 bg-white">Cancel</Button>
        <DynamicModal isOpen={false} onClose={() => {}} title="" description="" type="warning" size="md" primaryAction={{ label: "", onClick: () => {} }} />
      </form>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#0F172A]">Sign In</h1>
        <p className="text-[14px] mt-2 text-[#475569]">
          {loginType === "master" ? (<>New here? <Link href="/signup" className="text-[#1A56DB] font-bold hover:underline">Create an account.</Link></>) : "Sign in using credentials shared by your admin."}
        </p>
      </div>

      <div className="flex bg-[#F1F5F9] p-1 rounded-xl mb-6">
        {(["master", "team"] as LoginType[]).map((t) => (
          <button key={t} type="button" onClick={() => { setLoginType(t); setLocalError(""); reset(); }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all duration-200 ${loginType === t ? "bg-white text-[#1A56DB] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
            {t === "master" ? "Master Account" : "Team Member"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && <div className="p-3.5 bg-red-50 text-red-700 border border-red-100 rounded-xl text-sm font-semibold">{errorMsg}</div>}
        {loginType === "master" ? (
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-bold text-[#334155]">Email Address</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter email address" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantId" className="text-[13px] font-bold text-[#334155]">Tenant ID</Label>
              <Input id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required placeholder="Enter Tenant ID" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[13px] font-bold text-[#334155]">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Enter username" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-[13px] font-bold text-[#334155]">Password</Label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 focus:ring-offset-0" />
          {loginType === "master" && <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-bold text-[#1A56DB] hover:underline">Forgot password?</Link></div>}
        </div>
        <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] text-white hover:opacity-90 font-bold mt-4 shadow-[0_8px_20px_-6px_rgba(26,86,219,0.4)]">{isLoading ? "Signing in..." : "Continue"}</Button>
      </form>

      {loginType === "master" && (
        <>
          <div className="relative mt-8 mb-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E2E8F0]" /></div><div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[0.16em]"><span className="bg-white px-3 text-[#94A3B8]">OR</span></div></div>
          <div className="grid gap-3">
            {(["github", "google"] as const).map((provider) => (
              <button key={provider} type="button" disabled={!!oauthLoading} onClick={() => handleOAuth(provider)}
                className="flex items-center justify-center gap-3 w-full h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] font-bold text-sm hover:bg-white hover:border-[#CBD5E1] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all disabled:opacity-60">
                {oauthLoading === provider ? (
                  <div className="w-4 h-4 rounded-full border-2 border-[#CBD5E1] border-t-[#334155] animate-spin" />
                ) : provider === "github" ? (
                  <Github className="h-4 w-4 text-[#1e293b]" />
                ) : (
                  <Google className="h-4 w-4" />
                )}
                Sign in with {provider === "github" ? "GitHub" : "Google"}
              </button>
            ))}
          </div>
        </>
      )}

      <DynamicModal
        isOpen={state.status === "deletionScheduled"}
        onClose={reset}
        title="Account Scheduled for Deletion"
        description={`This account was scheduled for deletion${state.status === "deletionScheduled" && state.scheduledAt ? ` on ${new Date(state.scheduledAt).toLocaleDateString()}` : ""}. Do you want to restore full access?`}
        type="warning" size="md"
        primaryAction={{ label: isLoading ? "Restoring..." : "Restore Account", onClick: handleRestoreAccount, isLoading }}
        secondaryAction={{ label: "Cancel", onClick: reset }}
      />
    </>
  );
}
