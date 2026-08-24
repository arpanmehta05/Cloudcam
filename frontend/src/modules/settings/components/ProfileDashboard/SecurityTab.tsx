"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  KeyRound,
  ShieldCheck,
} from "@/icons";
import { SecurityAuditTables } from "./SecurityAuditTables";
import { SecurityPasswordCard } from "./SecurityPasswordCard";
import { useSecurityTabState } from "./useSecurityTab";

interface SecurityTabProps {
  showConfirm: (
    title: string,
    description: string,
    type: "info" | "success" | "warning" | "danger" | "default",
    primaryLabel: string,
    onConfirm: () => void | Promise<void>
  ) => void;
  showErrorModal: (title: string, message: string) => void;
  closeConfirm: () => void;
}

export function SecurityTab({
  showConfirm,
  showErrorModal,
  closeConfirm,
}: SecurityTabProps) {
  const {
    user,
    isReadOnlyUser,
    password,
    confirmPassword,
    savingPassword,
    passwordMessage,
    passwordOtp,
    requiresPasswordOtp,
    error,
    twoFactorMessage,
    savingTwoFactor,
    totpSecret,
    totpUrl,
    totpQrCode,
    totpCode,
    settingUpTotp,
    securityEvents,
    loadingSecurityEvents,
    fetchSecurityEvents,
    savePassword,
    toggleTwoFactor,
    beginAuthenticatorSetup,
    confirmAuthenticatorSetup,
    removeAuthenticatorSetup,
    setPassword,
    setConfirmPassword,
    setPasswordOtp,
    setRequiresPasswordOtp,
    setPasswordMessage,
    setTwoFactorMessage,
    setTotpSecret,
    setTotpUrl,
    setTotpQrCode,
    setTotpCode,
  } = useSecurityTabState();

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <SecurityPasswordCard
          hasPassword={user?.hasPassword}
          isReadOnlyUser={isReadOnlyUser}
          password={password}
          confirmPassword={confirmPassword}
          savingPassword={savingPassword}
          passwordMessage={passwordMessage}
          passwordOtp={passwordOtp}
          requiresPasswordOtp={requiresPasswordOtp}
          savePassword={savePassword}
          setPassword={setPassword}
          setConfirmPassword={setConfirmPassword}
          setPasswordOtp={setPasswordOtp}
          setRequiresPasswordOtp={setRequiresPasswordOtp}
          setPasswordMessage={setPasswordMessage}
        />

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Two-Factor Authentication (2FA)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {user?.username ? (
              !user?.twoFactorEnabled ? (
                totpSecret ? (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="rounded-xl border border-blue-100 bg-white p-5 dark:border-blue-950/30 dark:bg-slate-950/40">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Scan the QR Code
                      </h4>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                        Scan the QR code below with your authenticator app to enable 2FA.
                      </p>
                      <div className="flex flex-col items-center justify-center lg:flex-row lg:gap-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 max-w-lg mx-auto mt-4">
                        {totpQrCode ? (
                          <div className="relative p-2.5 bg-white rounded-xl shadow-sm border border-slate-200/50 shrink-0">
                            <img
                              src={totpQrCode}
                              alt="Authenticator QR Code"
                              className="h-36 w-36 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-36 w-36 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-400 shrink-0 animate-pulse text-xs font-bold">
                            Generating QR...
                          </div>
                        )}
                        <div className="mt-4 lg:mt-0 space-y-3 flex-1 w-full text-left">
                          <div className="space-y-1">
                            <Label
                              htmlFor="totp-secret"
                              className="text-xs font-bold text-slate-500"
                            >
                              Secret key
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="totp-secret"
                                value={totpSecret}
                                readOnly
                                className="font-mono text-xs h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-0 focus:ring-offset-0"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 px-2.5 text-xs font-bold"
                                onClick={() => {
                                  navigator.clipboard.writeText(totpSecret);
                                  setTwoFactorMessage("Key copied.");
                                }}
                              >
                                Copy
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-850/50 pt-4 mt-4">
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between max-w-md mx-auto">
                          <div className="space-y-1.5 flex-1">
                            <Label
                              htmlFor="totp-code"
                              className="text-xs font-bold text-slate-700 dark:text-slate-300"
                            >
                              6-digit confirmation code
                            </Label>
                            <Input
                              id="totp-code"
                              inputMode="numeric"
                              maxLength={6}
                              value={totpCode}
                              onChange={(event) =>
                                setTotpCode(
                                  event.target.value.replace(/\D/g, "").slice(0, 6)
                                )
                              }
                              placeholder="******"
                              className="text-center font-black tracking-[0.2em] text-base h-10 border-slate-200 dark:border-slate-800 rounded-lg focus:border-blue-500 bg-white dark:bg-slate-950"
                            />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setTotpSecret("");
                                setTotpQrCode("");
                                setTotpUrl("");
                                setTotpCode("");
                                setTwoFactorMessage(null);
                              }}
                              className="h-10 px-3 text-xs font-bold text-slate-500"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={confirmAuthenticatorSetup}
                              disabled={settingUpTotp || totpCode.length !== 6}
                              className="h-10 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold rounded-lg shadow-md shadow-blue-500/10"
                            >
                              Verify & Enable
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-900/50">
                        <ShieldCheck className="h-6 w-6" />
                      </span>
                      <h3 className="mt-4 text-sm font-bold text-slate-800 dark:text-white">
                        Two-factor authentication is disabled
                      </h3>
                      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Add an extra layer of security to your team account. Logins will require verification codes from an Authenticator App.
                      </p>
                      <div className="mt-5 flex justify-center">
                        <Button
                          type="button"
                          onClick={beginAuthenticatorSetup}
                          disabled={settingUpTotp}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold h-10 px-5 rounded-lg shadow-md shadow-blue-500/10"
                        >
                          {settingUpTotp ? "Starting..." : "Setup Authenticator App"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-800 dark:text-white">
                            Authenticator App (TOTP)
                          </span>
                          <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                            Status:{" "}
                            <span className="text-green-600 dark:text-green-400 font-bold">
                              Active & Connected
                            </span>
                            . Verification codes are required from your authenticator app during login.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={removeAuthenticatorSetup}
                          disabled={settingUpTotp}
                          className="h-9 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400"
                        >
                          {settingUpTotp ? "Removing..." : "Remove Authenticator (Disable 2FA)"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : !user?.twoFactorEnabled ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-900/50">
                    <ShieldCheck className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-slate-800 dark:text-white">
                    Two-factor authentication is disabled
                  </h3>
                  <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Add an extra layer of security to your account. Logins will require verification in addition to your password.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <Button
                      type="button"
                      onClick={toggleTwoFactor}
                      disabled={savingTwoFactor}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold h-10 px-5 rounded-lg shadow-md shadow-blue-500/10"
                    >
                      {savingTwoFactor ? "Enabling..." : "Enable 2FA (Step 1: Email OTP)"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="max-w-md mx-auto mb-8 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-inner">
                  <div className="relative flex justify-between items-center z-10">
                    <div className="absolute top-5 left-8 right-8 h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10 rounded-full" />
                    <div
                      className="absolute top-5 left-8 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 -translate-y-1/2 -z-10 rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                      style={{
                        width: user?.twoFactorMethod === "totp" ? "calc(100% - 64px)" : "0%",
                      }}
                    />
                    <div className="flex flex-col items-center flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/25 text-sm transition-all duration-300 hover:scale-110">
                        <svg
                          className="h-5 w-5 animate-pulse"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="mt-3 text-xs font-black text-slate-800 dark:text-slate-200">
                        Step 1: Email OTP
                      </span>
                      <span className="text-[10px] font-extrabold text-green-600 dark:text-green-400 mt-0.5 tracking-wider uppercase">
                        Verified
                      </span>
                    </div>
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm border-2 transition-all duration-500 ${
                          user?.twoFactorMethod === "totp"
                            ? "bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 border-transparent text-white shadow-lg shadow-indigo-500/25 hover:scale-110"
                            : "bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800"
                        }`}
                      >
                        {user?.twoFactorMethod === "totp" ? (
                          <svg
                            className="h-5 w-5 animate-bounce"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          "2"
                        )}
                      </div>
                      <span
                        className={`mt-3 text-xs font-black transition-colors duration-500 ${
                          user?.twoFactorMethod === "totp"
                            ? "text-slate-800 dark:text-slate-200"
                            : "text-slate-400"
                        }`}
                      >
                        Step 2: Auth App
                      </span>
                      <span
                        className={`text-[10px] font-extrabold mt-0.5 tracking-wider uppercase transition-colors duration-500 ${
                          user?.twoFactorMethod === "totp"
                            ? "text-green-600 dark:text-green-400"
                            : "text-slate-400"
                        }`}
                      >
                        {user?.twoFactorMethod === "totp" ? "Active" : "Optional"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-800 dark:text-white">
                          Step 1: Email OTP Verification
                        </span>
                        <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                          Status: <span className="text-green-600 dark:text-green-400 font-bold">Active & Verified</span>. A 6-digit security code is sent to your email to verify logins.
                        </span>
                      </div>
                    </div>
                    {user?.twoFactorMethod !== "totp" && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={toggleTwoFactor}
                        disabled={savingTwoFactor}
                        className="shrink-0 h-9 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400"
                      >
                        {savingTwoFactor ? "Saving..." : "Disable 2FA"}
                      </Button>
                    )}
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 transition-all duration-300 ${
                    user?.twoFactorMethod === "totp"
                      ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/30"
                      : "border-blue-100 bg-blue-50/5 dark:border-blue-900/20 dark:bg-blue-950/5"
                  }`}
                >
                  {user?.twoFactorMethod === "totp" ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-800 dark:text-white">
                            Step 2: Authenticator App (TOTP)
                          </span>
                          <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                            Status: <span className="text-green-600 dark:text-green-400 font-bold">Active & Connected</span>. Secure time-based verification app codes are preferred.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={removeAuthenticatorSetup}
                          disabled={settingUpTotp}
                          className="h-9 px-3 border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-850 dark:text-slate-400 dark:hover:bg-slate-900"
                        >
                          {settingUpTotp ? "Removing..." : "Remove Authenticator"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={toggleTwoFactor}
                          disabled={savingTwoFactor}
                          className="h-9 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400"
                        >
                          {savingTwoFactor ? "Saving..." : "Disable 2FA"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                            <KeyRound className="h-4.5 w-4.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-slate-800 dark:text-white">
                              Step 2: Connect Authenticator App
                            </span>
                            <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                              Upgrade security by connecting a TOTP app (like Google Authenticator, Authy, or Microsoft Authenticator).
                            </span>
                          </div>
                        </div>
                        {!totpSecret && (
                          <Button
                            type="button"
                            onClick={beginAuthenticatorSetup}
                            disabled={settingUpTotp}
                            className="shrink-0 h-9 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/10"
                          >
                            {settingUpTotp ? "Starting..." : "Connect App"}
                          </Button>
                        )}
                      </div>
                      {totpSecret ? (
                        <div className="mt-4 space-y-4 rounded-xl border border-blue-100 bg-white p-5 dark:border-blue-950/30 dark:bg-slate-950/40">
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            Scan the QR Code
                          </h4>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                            Scan the QR code below with your authenticator app.
                          </p>
                          <div className="flex flex-col items-center justify-center lg:flex-row lg:gap-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 max-w-lg mx-auto">
                            {totpQrCode ? (
                              <div className="relative p-2.5 bg-white rounded-xl shadow-sm border border-slate-200/50 shrink-0">
                                <img
                                  src={totpQrCode}
                                  alt="Authenticator QR Code"
                                  className="h-36 w-36 object-contain"
                                />
                              </div>
                            ) : (
                              <div className="h-36 w-36 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-400 shrink-0 animate-pulse text-xs font-bold">
                                Generating QR...
                              </div>
                            )}
                            <div className="mt-4 lg:mt-0 space-y-3 flex-1 w-full text-left">
                              <div className="space-y-1">
                                <Label
                                  htmlFor="totp-secret"
                                  className="text-xs font-bold text-slate-500"
                                >
                                  Secret key
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id="totp-secret"
                                    value={totpSecret}
                                    readOnly
                                    className="font-mono text-xs h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-0 focus:ring-offset-0"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-9 px-2.5 text-xs font-bold"
                                    onClick={() => {
                                      navigator.clipboard.writeText(totpSecret);
                                      setTwoFactorMessage("Key copied.");
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-slate-100 dark:border-slate-850/50 pt-4">
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between max-w-md mx-auto">
                              <div className="space-y-1.5 flex-1">
                                <Label
                                  htmlFor="totp-code"
                                  className="text-xs font-bold text-slate-700 dark:text-slate-300"
                                >
                                  6-digit confirmation code
                                </Label>
                                <Input
                                  id="totp-code"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={totpCode}
                                  onChange={(event) =>
                                    setTotpCode(
                                      event.target.value.replace(/\D/g, "").slice(0, 6)
                                    )
                                  }
                                  placeholder="******"
                                  className="text-center font-black tracking-[0.2em] text-base h-10 border-slate-200 dark:border-slate-800 rounded-lg focus:border-blue-500 bg-white dark:bg-slate-950"
                                />
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => {
                                    setTotpSecret("");
                                    setTotpQrCode("");
                                    setTotpUrl("");
                                    setTotpCode("");
                                    setTwoFactorMessage(null);
                                  }}
                                  className="h-10 px-3 text-xs font-bold text-slate-500"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  onClick={confirmAuthenticatorSetup}
                                  disabled={settingUpTotp || totpCode.length !== 6}
                                  className="h-10 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold rounded-lg shadow-md shadow-blue-500/10"
                                >
                                  Verify & Enable
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
            {twoFactorMessage ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/20 p-3 text-xs font-semibold text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400">
                {twoFactorMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <SecurityAuditTables
        user={user}
        securityEvents={securityEvents}
        loadingSecurityEvents={loadingSecurityEvents}
        fetchSecurityEvents={fetchSecurityEvents}
      />
    </div>
  );
}
