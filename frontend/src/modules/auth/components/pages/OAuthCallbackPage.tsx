"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { extractCallbackParams } from "@/lib/oauth";
import { authFetchJson } from "@/lib/auth-fetch";
import { consumePostAuthRedirect } from "@/lib/post-auth-redirect";
import { z } from "zod";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

const AuthEnvelopeSchema = z.object({
    success: z.boolean(),
    token: z.string(),
    user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        awsConnected: z.boolean(),
        awsCredentials: z.object({
            roleArn: z.string(),
            externalId: z.string(),
            connectedAt: z.string(),
        }).nullable().optional(),
    }),
});

function OAuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setOAuthSession } = useAuth();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const processedRef = useRef(false);

    useEffect(() => {
        // Prevent double-execution in React StrictMode
        if (processedRef.current) return;
        processedRef.current = true;

        async function handleCallback() {
            try {
                const result = extractCallbackParams(searchParams);

                if ("error" in result) {
                    setErrorMessage(result.error);
                    setStatus("error");
                    return;
                }

                const { provider, code, codeVerifier, redirectUri } = result;

                if (provider === "google" && !codeVerifier) {
                    setErrorMessage("Missing PKCE code verifier. Please start Google sign-in again from the login page.");
                    setStatus("error");
                    return;
                }

                // Exchange code for JWT via backend
                // Check if this is a connect flow (e.g. connecting GitHub to an existing account)
                const isConnectFlow = sessionStorage.getItem("connect_github") === "true";
                if (isConnectFlow) {
                    sessionStorage.removeItem("connect_github");
                    await authFetchJson("/api/github/connect", z.object({ success: z.boolean() }), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code,
                            redirectUri,
                        }),
                    });

                    setStatus("success");
                    const redirectBack = sessionStorage.getItem("github_redirect_back") || "/simulation";
                    sessionStorage.removeItem("github_redirect_back");
                    setTimeout(() => router.push(redirectBack), 500);
                    return;
                }

                const data = await authFetchJson("/api/oauth/callback", AuthEnvelopeSchema, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        provider,
                        code,
                        codeVerifier,
                        code_verifier: codeVerifier,
                        redirectUri,
                    }),
                });

                // Store token and update auth state
                localStorage.setItem("rabbittize_token", data.token);
                setOAuthSession(data.token, data.user);

                setStatus("success");

                // Return the user where they started (e.g. the Agent Watcher
                // page with system_type preserved), falling back to dashboard.
                const dest = consumePostAuthRedirect("/dashboard");
                setTimeout(() => router.push(dest), 500);
            } catch (err: any) {
                console.error("[OAuth Callback] Error:", err);
                setErrorMessage(err.message || "Authentication failed. Please try again.");
                setStatus("error");
            }
        }

        handleCallback();
    }, [searchParams, router, setOAuthSession]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans">
            <div className="w-full max-w-md mx-auto px-6">
                <div className="bg-white rounded-[24px] shadow-[0_32px_64px_-12px_rgba(26,86,219,0.2)] border border-white/50 p-8 sm:p-10 text-center">
                    <BrandMark className="mx-auto mb-8" logoClassName="h-10 w-10" />

                    {status === "loading" && (
                        <div className="space-y-4">
                            {/* Animated spinner */}
                            <div className="flex justify-center">
                                <div className="relative w-12 h-12">
                                    <div className="absolute inset-0 rounded-full border-[3px] border-[#E2E8F0]" />
                                    <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#1A56DB] animate-spin" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-[#0F172A]">Completing sign in...</h2>
                                <p className="text-sm text-[#64748B] mt-1">Securely verifying your identity</p>
                            </div>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="space-y-4">
                            <div className="flex justify-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6 9 17l-5-5"/>
                                    </svg>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-[#0F172A]">Welcome back!</h2>
                                <p className="text-sm text-[#64748B] mt-1">Redirecting to your dashboard...</p>
                            </div>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="space-y-5">
                            <div className="flex justify-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="15" y1="9" x2="9" y2="15"/>
                                        <line x1="9" y1="9" x2="15" y2="15"/>
                                    </svg>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-[#0F172A]">Authentication Failed</h2>
                                <p className="text-sm text-[#64748B] mt-2 leading-relaxed">{errorMessage}</p>
                            </div>
                            <div className="pt-2 grid gap-3">
                                <Link
                                    href="/login"
                                    className="flex items-center justify-center h-11 rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#3B82F6] text-white font-bold text-sm shadow-[0_8px_20px_-6px_rgba(26,86,219,0.4)] transition-all hover:opacity-90"
                                >
                                    Back to Sign In
                                </Link>
                                <Link
                                    href="/signup"
                                    className="flex items-center justify-center h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] font-bold text-sm hover:bg-white transition-colors"
                                >
                                    Create an Account
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function OAuthCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
                    <div className="relative w-8 h-8">
                        <div className="absolute inset-0 rounded-full border-[3px] border-[#E2E8F0]" />
                        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#1A56DB] animate-spin" />
                    </div>
                </div>
            }
        >
            <OAuthCallbackContent />
        </Suspense>
    );
}
