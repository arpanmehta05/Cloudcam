"use client";

import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useRegion } from "@/context/RegionContext";
import { authFetchJson } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import {
  Cloud,
  Mail,
  Loader2,
  CheckCircle2,
  XCircle,
} from "@/icons";
import { SettingRow, NotificationSettingsEnvelopeSchema } from "./shared";

export function PreferencesTab() {
  const { user } = useAuth();
  const isReadOnlyUser =
    user?.permissionLevel === "viewer" || user?.permissionLevel === "operator";
  const { selectedProvider } = useRegion();

  const [notificationSettings, setNotificationSettings] = useState<{
    slack: {
      enabled: boolean;
      connected: boolean;
      lastFour: string | null;
      connectedAt: string | null;
      botConnected?: boolean;
      secretConnected?: boolean;
    };
    email: { enabled: boolean };
  } | null>(null);
  const [slackUrlInput, setSlackUrlInput] = useState("");
  const [slackBotTokenInput, setSlackBotTokenInput] = useState("");
  const [slackSigningSecretInput, setSlackSigningSecretInput] = useState("");
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [notificationsStatus, setNotificationsStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchNotificationSettings = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const data = await authFetchJson(
        "/api/settings/notifications",
        NotificationSettingsEnvelopeSchema
      );
      if (data.success) {
        setNotificationSettings(data.settings);
        if (data.settings.slack.connected) {
          setSlackUrlInput("••••••••••••••••••••");
        } else {
          setSlackUrlInput("");
        }
        if (data.settings.slack.botConnected) {
          setSlackBotTokenInput("••••••••••••••••••••");
        } else {
          setSlackBotTokenInput("");
        }
        if (data.settings.slack.secretConnected) {
          setSlackSigningSecretInput("••••••••••••••••••••");
        } else {
          setSlackSigningSecretInput("");
        }
      }
    } catch (err) {
      console.error("Failed to fetch notification settings:", err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotificationSettings();
  }, [fetchNotificationSettings]);

  const saveNotificationSettings = async (
    emailEnabled: boolean,
    slackEnabled: boolean,
    webhookUrl?: string,
    botToken?: string,
    signingSecret?: string
  ) => {
    setSavingNotifications(true);
    setNotificationsStatus(null);
    try {
      const payload: any = {
        email: { enabled: emailEnabled },
        slack: { enabled: slackEnabled },
      };
      if (webhookUrl !== undefined) {
        payload.slack.webhookUrl = webhookUrl;
      }
      if (botToken !== undefined) {
        payload.slack.botToken = botToken;
      }
      if (signingSecret !== undefined) {
        payload.slack.signingSecret = signingSecret;
      }
      const data = await authFetchJson(
        "/api/settings/notifications",
        z.object({
          success: z.boolean(),
          settings: z.any().optional(),
          error: z.string().optional(),
        }),
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
      if (data.success) {
        setNotificationSettings(data.settings);
        setNotificationsStatus({
          type: "success",
          message: "Notification settings updated successfully.",
        });
        if (data.settings.slack.connected) {
          setSlackUrlInput("••••••••••••••••••••");
        } else {
          setSlackUrlInput("");
        }
        if (data.settings.slack.botConnected) {
          setSlackBotTokenInput("••••••••••••••••••••");
        } else {
          setSlackBotTokenInput("");
        }
        if (data.settings.slack.secretConnected) {
          setSlackSigningSecretInput("••••••••••••••••••••");
        } else {
          setSlackSigningSecretInput("");
        }
      } else {
        setNotificationsStatus({
          type: "error",
          message: data.error || "Failed to update notification settings.",
        });
      }
    } catch (err: any) {
      setNotificationsStatus({
        type: "error",
        message: err.message || "Failed to update notification settings.",
      });
    } finally {
      setSavingNotifications(false);
    }
  };

  const testSlackNotification = async () => {
    setTestingNotifications(true);
    setNotificationsStatus(null);
    try {
      const payload: any = {};
      if (slackUrlInput && slackUrlInput !== "••••••••••••••••••••") {
        payload.webhookUrl = slackUrlInput;
      }
      const data = await authFetchJson(
        "/api/settings/notifications/slack/test",
        z.object({
          success: z.boolean(),
          message: z.string().optional(),
        }),
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      if (data.success) {
        setNotificationsStatus({
          type: "success",
          message:
            "Test connection notification sent successfully. Please check your Slack channel!",
        });
      } else {
        setNotificationsStatus({
          type: "error",
          message: data.message || "Failed to send test notification.",
        });
      }
    } catch (err: any) {
      setNotificationsStatus({
        type: "error",
        message: err.message || "Failed to send test notification.",
      });
    } finally {
      setTestingNotifications(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Workspace Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <SettingRow
            icon={Cloud}
            title="Default provider"
            body={
              <span>
                <strong className="text-slate-900 dark:text-white font-extrabold">
                  {selectedProvider.toUpperCase()}
                </strong>{" "}
                is selected in the current workspace.
              </span>
            }
            status="live"
          />
          <SettingRow
            href={!isReadOnlyUser ? "/settings/reports" : undefined}
            icon={Mail}
            title="Report cadence"
            body={
              !isReadOnlyUser
                ? "Usage and insight reports can be managed from report settings today."
                : "Managed by the account administrator."
            }
            status="live"
          />
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Notification Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationsStatus && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3.5 text-xs font-semibold leading-normal",
                notificationsStatus.type === "success"
                  ? "border-emerald-250 bg-emerald-50 text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-450"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400"
              )}
            >
              {notificationsStatus.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <div>{notificationsStatus.message}</div>
            </div>
          )}

          {loadingNotifications ? (
            <div className="flex h-32 items-center justify-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
              Loading notification settings...
            </div>
          ) : !notificationSettings ? (
            <div className="text-xs font-semibold text-red-600">
              Failed to load notification settings.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="block text-sm font-bold text-slate-800 dark:text-white">
                        Slack Notifications
                      </span>
                      {notificationSettings.slack.connected && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold"
                        >
                          Connected
                        </Badge>
                      )}
                    </div>
                    <span className="block text-xs text-slate-500">
                      Deliver anomalies, costs, and optimization reports directly to a Slack channel.
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={notificationSettings.slack.enabled ? "default" : "outline"}
                    onClick={() => {
                      if (!notificationSettings.slack.connected) {
                        setNotificationsStatus({
                          type: "error",
                          message: "Please connect and save a Slack Webhook URL first.",
                        });
                        return;
                      }
                      saveNotificationSettings(
                        notificationSettings.email.enabled,
                        !notificationSettings.slack.enabled
                      );
                    }}
                    disabled={savingNotifications || !notificationSettings.slack.connected}
                    className="h-10 text-xs font-bold shrink-0 min-w-[120px]"
                  >
                    {savingNotifications
                      ? "Saving..."
                      : notificationSettings.slack.enabled
                        ? "Enabled"
                        : "Disabled"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Webhook URL
                  </Label>
                  <div className="flex gap-2 max-w-2xl">
                    <Input
                      type="text"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackUrlInput}
                      onChange={(e) => setSlackUrlInput(e.target.value)}
                      disabled={notificationSettings.slack.connected || savingNotifications}
                      className="h-10 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                    <div className="flex gap-2">
                      {notificationSettings.slack.connected && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            saveNotificationSettings(
                              notificationSettings.email.enabled,
                              false,
                              ""
                            )
                          }
                          disabled={savingNotifications}
                          className="h-10 text-xs font-bold border-red-200 hover:bg-red-50 text-red-600 dark:border-red-950 dark:hover:bg-red-950/20 dark:text-red-400"
                        >
                          Disconnect Webhook
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Slack Bot Token (xoxb-...)
                    </Label>
                    <Input
                      type="password"
                      placeholder="xoxb-..."
                      value={slackBotTokenInput}
                      onChange={(e) => setSlackBotTokenInput(e.target.value)}
                      disabled={notificationSettings.slack.botConnected || savingNotifications}
                      className="h-10 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                    {notificationSettings.slack.botConnected && (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() =>
                          saveNotificationSettings(
                            notificationSettings.email.enabled,
                            notificationSettings.slack.enabled,
                            undefined,
                            ""
                          )
                        }
                        disabled={savingNotifications}
                        className="text-xs text-red-550 hover:text-red-700 h-auto p-0 font-bold"
                      >
                        Disconnect Bot Token
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Slack Signing Secret
                    </Label>
                    <Input
                      type="password"
                      placeholder="Signing Secret"
                      value={slackSigningSecretInput}
                      onChange={(e) => setSlackSigningSecretInput(e.target.value)}
                      disabled={notificationSettings.slack.secretConnected || savingNotifications}
                      className="h-10 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                    {notificationSettings.slack.secretConnected && (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() =>
                          saveNotificationSettings(
                            notificationSettings.email.enabled,
                            notificationSettings.slack.enabled,
                            undefined,
                            undefined,
                            ""
                          )
                        }
                        disabled={savingNotifications}
                        className="text-xs text-red-550 hover:text-red-700 h-auto p-0 font-bold"
                      >
                        Disconnect Signing Secret
                      </Button>
                    )}
                  </div>
                </div>

                {(!notificationSettings.slack.connected ||
                  !notificationSettings.slack.botConnected ||
                  !notificationSettings.slack.secretConnected) && (
                  <div className="flex gap-2">
                    {!notificationSettings.slack.connected && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={testSlackNotification}
                        disabled={
                          testingNotifications ||
                          savingNotifications ||
                          !slackUrlInput.trim() ||
                          slackUrlInput === "••••••••••••••••••••"
                        }
                        className="h-10 text-xs font-bold border-slate-200 dark:border-slate-800"
                      >
                        {testingNotifications ? "Testing..." : "Test Webhook"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => {
                        const cleanUrl =
                          slackUrlInput === "••••••••••••••••••••"
                            ? undefined
                            : slackUrlInput.trim() || undefined;
                        const cleanBot =
                          slackBotTokenInput === "••••••••••••••••••••"
                            ? undefined
                            : slackBotTokenInput.trim() || undefined;
                        const cleanSecret =
                          slackSigningSecretInput === "••••••••••••••••••••"
                            ? undefined
                            : slackSigningSecretInput.trim() || undefined;
                        saveNotificationSettings(
                          notificationSettings.email.enabled,
                          true,
                          cleanUrl,
                          cleanBot,
                          cleanSecret
                        );
                      }}
                      disabled={savingNotifications}
                      className="h-10 text-xs font-bold"
                    >
                      {savingNotifications ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                )}

                <div className="grid gap-4 grid-cols-1 max-w-2xl">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                      Slack Events Redirect URI
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                      Configure the following URL as your Slack App's <b>Events Request URL</b> to support bidirectional alarm creation commands:
                    </p>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-lg text-xs font-mono select-all text-slate-800 dark:text-slate-300">
                      {typeof window !== "undefined"
                        ? window.location.origin + "/api/integrations/slack/events"
                        : "/api/integrations/slack/events"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                      Slack Interactive Redirect URI
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                      Configure the following URL as your Slack App's <b>Interactivity Request URL</b> to support drop-down selector menus:
                    </p>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-lg text-xs font-mono select-all text-slate-800 dark:text-slate-300">
                      {typeof window !== "undefined"
                        ? window.location.origin + "/api/integrations/slack/interactive"
                        : "/api/integrations/slack/interactive"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
