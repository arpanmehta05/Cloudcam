"use client";

import { FormEvent, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { authFetchJson } from "@/lib/auth-fetch";
import { Save, Mail, User, Globe, Github } from "@/icons";
import { SettingRow, DetailRow, initials, ProfileEnvelopeSchema } from "./shared";

interface AccountTabProps {
  handleTabChange: (value: string) => void;
}

export function AccountTab({ handleTabChange }: AccountTabProps) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authProvider = user?.provider || "email";

  const joinedAt = useMemo(() => {
    if (!user?.createdAt) return "Coming soon";
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(user.createdAt));
  }, [user?.createdAt]);

  const updatedAt = useMemo(() => {
    if (!user?.updatedAt) return "Not available";
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(user.updatedAt));
  }, [user?.updatedAt]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      await authFetchJson("/api/auth/profile", ProfileEnvelopeSchema, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      await refreshUser();
      setProfileMessage("Profile updated.");
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Profile Details</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="profile-name"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Name
                </Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 rounded-lg border-slate-200 dark:border-slate-800"
                />
              </div>
              {user?.username ? (
                <div className="space-y-2">
                  <Label
                    htmlFor="profile-username"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Username
                  </Label>
                  <Input
                    id="profile-username"
                    value={user.username}
                    disabled
                    className="h-11 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label
                    htmlFor="profile-email"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Email
                  </Label>
                  <Input
                    id="profile-email"
                    value={user?.email || ""}
                    disabled
                    className="h-11 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
                  />
                </div>
              )}
            </div>
            {user?.username && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="profile-tenant"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Tenant ID
                  </Label>
                  <Input
                    id="profile-tenant"
                    value={user.tenantId || ""}
                    disabled
                    className="h-11 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="profile-email-team"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Email (Optional Alerts)
                  </Label>
                  <Input
                    id="profile-email-team"
                    value={user.email || "No email configured"}
                    disabled
                    className="h-11 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
                  />
                </div>
              </div>
            )}
            <div className="grid gap-3">
              {user?.username ? (
                <SettingRow
                  compact
                  icon={User}
                  title="Username authentication"
                  body={
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40">
                        {user.username}
                      </span>
                      <span>is verified for tenant access.</span>
                    </span>
                  }
                  status="live"
                />
              ) : (
                <SettingRow
                  compact
                  icon={Mail}
                  title="Email verification"
                  body={
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40">
                        {user?.email || "Account email"}
                      </span>
                      <span>is verified for account access.</span>
                    </span>
                  }
                  status="live"
                />
              )}
              <SettingRow
                compact
                icon={User}
                title="Role controls"
                body={
                  user?.permissionLevel === "admin" ? (
                    <span>
                      Configure and manage member roles and workspace permissions as an{" "}
                      <span className="inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-100 dark:border-red-900/40">
                        admin
                      </span>
                      .
                    </span>
                  ) : (
                    <span>
                      Your current workspace role is{" "}
                      <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                        {user?.permissionLevel || "operator"}
                      </span>
                      .
                    </span>
                  )
                }
                status="live"
                onClick={
                  user?.permissionLevel === "admin"
                    ? () => handleTabChange("team")
                    : undefined
                }
              />
              <SettingRow
                compact
                icon={Globe}
                title="Workspace profile"
                body={
                  user?.permissionLevel === "admin" ? (
                    "View workspace name, manage active members, and control workspace settings."
                  ) : (
                    <span>
                      Workspace profile and team members are managed by the{" "}
                      <strong className="text-slate-700 dark:text-slate-300">
                        Workspace Administrator
                      </strong>
                      .
                    </span>
                  )
                }
                status="live"
                onClick={
                  user?.permissionLevel === "admin"
                    ? () => handleTabChange("team")
                    : undefined
                }
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={savingProfile}
                className="gap-2 h-11 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold rounded-lg shadow-md shadow-blue-500/10"
              >
                <Save className="h-4 w-4" />
                {savingProfile ? "Saving..." : "Save profile"}
              </Button>
              {profileMessage ? (
                <span className="text-sm font-bold text-green-600">
                  {profileMessage}
                </span>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Account Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/20">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              {authProvider === "github" ? (
                <Github className="h-5 w-5" />
              ) : authProvider === "google" ? (
                <Globe className="h-5 w-5" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold capitalize text-slate-800 dark:text-white">
                {authProvider} account
              </span>
              <span className="block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                {user?.email || "No email found"}
              </span>
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            <DetailRow label="Sign-in method" value={authProvider} />
            <DetailRow
              label="Password login"
              value={user?.hasPassword ? "Enabled" : "Not enabled"}
            />
            <DetailRow
              label="Role"
              value={user?.permissionLevel || "operator"}
            />
            <DetailRow
              label="Workspace"
              value={
                user?.defaultWorkspaceId
                  ? "Personal workspace"
                  : "Default workspace"
              }
            />
            <DetailRow label="Joined" value={joinedAt} />
            <DetailRow label="Updated" value={updatedAt} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
