"use client";

/**
 * TotpSetup — TOTP authenticator enrollment component.
 * Renders QR code URI for scanning and a verification input.
 * Used in profile/settings pages for 2FA setup.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { authFetchJson } from "@/lib/auth-fetch";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";

const TotpSetupSchema = z.object({
  success: z.boolean(),
  qrCodeUri: z.string(),
  secret: z.string(),
});

const TotpVerifySchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

interface TotpSetupProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TotpSetup({ onSuccess, onCancel }: TotpSetupProps) {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<"setup" | "verify">("setup");
  const [qrCodeUri, setQrCodeUri] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSetup = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await authFetchJson("/api/auth/totp/setup", TotpSetupSchema, { method: "POST" });
      setQrCodeUri(data.qrCodeUri);
      setSecret(data.secret);
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Failed to initiate TOTP setup");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await authFetchJson("/api/auth/totp/verify", TotpVerifySchema, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      await refreshUser();
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "setup") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#475569]">Set up an authenticator app for more secure two-factor login.</p>
        {error && <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm">{error}</div>}
        <Button onClick={handleSetup} disabled={isLoading} className="w-full h-11 rounded-xl bg-[#1A56DB] text-white font-bold hover:opacity-90">
          {isLoading ? "Setting up..." : "Set Up Authenticator"}
        </Button>
        {onCancel && <Button onClick={onCancel} variant="outline" className="w-full h-11 rounded-xl">Cancel</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#475569]">Scan the QR code below with your authenticator app, then enter the 6-digit code.</p>
      {qrCodeUri && (
        <div className="flex justify-center p-4 bg-white border border-[#E2E8F0] rounded-xl">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCodeUri)}`} alt="TOTP QR Code" className="w-40 h-40" />
        </div>
      )}
      {secret && <p className="text-xs text-center text-[#64748B] font-mono bg-[#F8FAFC] p-2 rounded-lg border border-[#E2E8F0]">Manual key: {secret}</p>}
      {error && <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm">{error}</div>}
      <form onSubmit={handleVerify} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="totpCode" className="text-[13px] font-bold text-[#334155]">Verification Code</Label>
          <Input id="totpCode" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required placeholder="000000" className="h-12 rounded-xl border-[#CBD5E1] text-center text-lg font-extrabold tracking-[0.4em]" />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full h-11 rounded-xl bg-[#1A56DB] text-white font-bold hover:opacity-90">{isLoading ? "Verifying..." : "Verify & Enable"}</Button>
        {onCancel && <Button type="button" onClick={onCancel} variant="outline" className="w-full h-11 rounded-xl">Cancel</Button>}
      </form>
    </div>
  );
}
