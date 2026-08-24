"use client";

import { FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { KeyRound } from "@/icons";

interface SecurityPasswordCardProps {
  hasPassword?: boolean;
  isReadOnlyUser: boolean;
  password: string;
  confirmPassword: string;
  savingPassword: boolean;
  passwordMessage: string | null;
  passwordOtp: string;
  requiresPasswordOtp: boolean;
  savePassword: (event: FormEvent) => void;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setPasswordOtp: (value: string) => void;
  setRequiresPasswordOtp: (value: boolean) => void;
  setPasswordMessage: (value: string | null) => void;
}

export function SecurityPasswordCard({
  hasPassword,
  isReadOnlyUser,
  password,
  confirmPassword,
  savingPassword,
  passwordMessage,
  passwordOtp,
  requiresPasswordOtp,
  savePassword,
  setPassword,
  setConfirmPassword,
  setPasswordOtp,
  setRequiresPasswordOtp,
  setPasswordMessage,
}: SecurityPasswordCardProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={savePassword} className="space-y-4">
          {isReadOnlyUser && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Password updates are managed by the account administrator.
            </div>
          )}
          <div className="space-y-2">
            <Label
              htmlFor="new-password"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              {hasPassword ? "New password" : "Create password"}
            </Label>
            <PasswordInput
              id="new-password"
              disabled={isReadOnlyUser || requiresPasswordOtp}
              value={password}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-lg border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="confirm-password"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Confirm password
            </Label>
            <PasswordInput
              id="confirm-password"
              disabled={isReadOnlyUser || requiresPasswordOtp}
              value={confirmPassword}
              minLength={6}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-11 rounded-lg border-slate-200 dark:border-slate-800"
            />
          </div>
          {requiresPasswordOtp && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label
                htmlFor="password-otp"
                className="text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Email Verification Code (OTP)
              </Label>
              <Input
                id="password-otp"
                placeholder="Enter 6-digit code"
                maxLength={6}
                value={passwordOtp}
                onChange={(event) =>
                  setPasswordOtp(event.target.value.replace(/\D/g, ""))
                }
                className="h-11 rounded-lg border-slate-200 dark:border-slate-800 font-mono tracking-widest text-center text-lg"
              />
            </div>
          )}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={isReadOnlyUser || savingPassword}
              className="gap-2 h-11 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold rounded-lg shadow-md shadow-blue-500/10"
            >
              <KeyRound className="h-4 w-4" />
              {savingPassword
                ? "Updating..."
                : requiresPasswordOtp
                  ? "Confirm Password Change"
                  : hasPassword
                    ? "Update password"
                    : "Enable password login"}
            </Button>
            {requiresPasswordOtp && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRequiresPasswordOtp(false);
                  setPasswordOtp("");
                  setPasswordMessage(null);
                }}
                className="h-11 rounded-lg border-slate-200 dark:border-slate-800"
              >
                Cancel
              </Button>
            )}
            {passwordMessage ? (
              <span className="text-sm font-bold text-green-600">
                {passwordMessage}
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
