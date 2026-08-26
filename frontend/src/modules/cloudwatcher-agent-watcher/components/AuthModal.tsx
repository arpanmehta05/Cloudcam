"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Github, Google, Loader2, X } from "@/icons";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/context/AuthContext";
import { useLogin } from "@/modules/auth";
import { setPostAuthRedirect } from "@/lib/post-auth-redirect";

/**
 * Dedicated sign-in modal for the Agent Watcher flow.
 *
 * Reuses the app's auth primitives (useLogin, oauthLogin, shared inputs/icons)
 * but is its own component so it can trigger inline from this page. Email/OAuth
 * sign IN happens here; sign UP is delegated to the existing /signup page with a
 * post-auth redirect so the user returns to this exact page afterwards.
 */
export function AuthModal({
  open,
  onClose,
  redirectPath,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  redirectPath: string;
  onAuthenticated: () => void;
}) {
  const router = useRouter();
  const { oauthLogin, setOAuthSession } = useAuth();
  const { state, login } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [localError, setLocalError] = useState("");

  const isLoading = state.status === "loading";
  const errorMsg = state.status === "error" ? state.message : localError;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const rememberReturn = () => setPostAuthRedirect(redirectPath);

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setLocalError("");
    rememberReturn(); // OAuth round-trips through /oauth/callback, which returns here.
    try {
      await oauthLogin(provider);
    } catch (err: any) {
      setLocalError(err?.message || "Sign-in failed");
      setOauthLoading(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    try {
      const result = await login(email, password);

      // Edge cases (2FA, forced password reset, scheduled deletion) need the
      // full login screen — hand off there, preserving the return path.
      if (result.requires2fa || result.requiresPasswordReset || result.deletionScheduled) {
        rememberReturn();
        onClose();
        router.push("/login");
        return;
      }

      if (result.token && result.user) {
        localStorage.setItem("rabbittize_token", result.token);
        setOAuthSession(result.token, result.user as any);
        onClose();
        onAuthenticated();
      }
    } catch {
      /* state already carries the error message */
    }
  };

  const goToSignup = () => {
    rememberReturn();
    onClose();
    router.push("/signup");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Sign in to Cloudcam"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[24px] border border-white/60 bg-white p-7 shadow-[0_32px_64px_-12px_rgba(26,86,219,0.28)] sm:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <X className="h-4 w-4" />
            </button>

            <BrandMark className="mb-6" logoClassName="h-9 w-9" />
            <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Sign in to continue</h2>
            <p className="mt-1.5 text-sm text-[#475569]">
              Sign in and we&apos;ll drop your check prompt right into the page.
            </p>

            {errorMsg ? (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
                {errorMsg}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              {(["github", "google"] as const).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  disabled={!!oauthLoading}
                  onClick={() => handleOAuth(provider)}
                  className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-bold text-[#334155] transition-all hover:border-[#CBD5E1] hover:bg-white hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] disabled:opacity-60"
                >
                  {oauthLoading === provider ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : provider === "github" ? (
                    <Github className="h-4 w-4 text-[#1e293b]" />
                  ) : (
                    <Google className="h-4 w-4" />
                  )}
                  Continue with {provider === "github" ? "GitHub" : "Google"}
                </button>
              ))}
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E2E8F0]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                  or
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cw-email" className="text-[13px] font-bold text-[#334155]">
                  Email address
                </Label>
                <Input
                  id="cw-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cw-password" className="text-[13px] font-bold text-[#334155]">
                  Password
                </Label>
                <PasswordInput
                  id="cw-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="h-12 rounded-xl border-[#CBD5E1] bg-white px-4 text-[14px] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] font-bold text-white shadow-[0_8px_20px_-6px_rgba(26,86,219,0.5)] transition-all hover:opacity-90 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#64748B]">
              New here?{" "}
              <button
                type="button"
                onClick={goToSignup}
                className="font-bold text-[#1A56DB] hover:underline"
              >
                Create an account
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
