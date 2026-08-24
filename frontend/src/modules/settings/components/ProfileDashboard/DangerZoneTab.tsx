"use client";

import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { authFetchJson } from "@/lib/auth-fetch";
import { LogOut, KeyRound, Lock } from "@/icons";
import { SettingRow } from "./shared";

interface DangerZoneTabProps {
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

export function DangerZoneTab({
  showConfirm,
  showErrorModal,
  closeConfirm,
}: DangerZoneTabProps) {
  const { user, logout } = useAuth();

  const handleDeleteAccountRequest = () => {
    showConfirm(
      "Deactivate Account",
      "WARNING: This will permanently deactivate your account. All your cloud configurations, metrics, and team access will be disabled. This action cannot be undone — you will not be able to log back in. Are you sure you want to proceed?",
      "danger",
      "Deactivate Account",
      async () => {
        try {
          await authFetchJson(
            "/api/auth/delete-account",
            z.object({
              success: z.boolean(),
              message: z.string(),
            }),
            {
              method: "POST",
            }
          );

          closeConfirm();

          showConfirm(
            "Account Deactivated",
            "Your account has been permanently deactivated. You will be logged out now.",
            "success",
            "Dismiss",
            () => {
              closeConfirm();
              logout();
              window.location.href = "/";
            }
          );
        } catch (err: any) {
          showErrorModal(
            "Deletion Failed",
            err.message || "Failed to schedule account deletion"
          );
        }
      }
    );
  };

  return (
    <Card className="border-red-200 dark:border-red-900/40 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-red-600 dark:text-red-400">
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <SettingRow
          icon={LogOut}
          title="Log out all devices"
          body="Requires active session tracking before enabling."
          status="soon"
        />
        <SettingRow
          icon={KeyRound}
          title="Revoke all tokens"
          body="Requires token registry before enabling."
          status="soon"
        />
        <SettingRow
          icon={Lock}
          title="Delete account"
          body={
            user?.permissionLevel === "admin"
              ? "Permanently deactivate this account. This action cannot be undone."
              : "Only administrators can deactivate this account."
          }
          status={user?.permissionLevel === "admin" ? "live" : "soon"}
          onClick={
            user?.permissionLevel === "admin"
              ? handleDeleteAccountRequest
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
