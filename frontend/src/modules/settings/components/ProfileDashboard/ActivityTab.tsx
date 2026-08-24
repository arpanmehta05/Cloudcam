"use client";

import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { authFetchJson } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import {
  Bell,
  RefreshCw,
  Mail,
  MessageSquare,
  Cloud,
} from "@/icons";
import { SettingRow, formatRelativeTime } from "./shared";

export function ActivityTab() {
  const { user } = useAuth();
  const [notificationHistory, setNotificationHistory] = useState<any[]>([]);
  const [loadingNotificationHistory, setLoadingNotificationHistory] = useState(false);

  const fetchNotificationHistory = useCallback(async () => {
    if (!user) return;
    setLoadingNotificationHistory(true);
    try {
      const data = await authFetchJson(
        "/api/auth/notifications/history",
        z.object({
          success: z.boolean(),
          history: z.array(
            z.object({
              _id: z.string(),
              title: z.string(),
              message: z.string(),
              severity: z.string(),
              channels: z.object({
                email: z.object({ status: z.string() }),
                slack: z.object({ status: z.string() }),
                webhook: z.object({ status: z.string() }),
              }),
              createdAt: z.string(),
            })
          ),
        })
      );
      setNotificationHistory(data.history);
    } catch (err: any) {
      console.error("Failed to fetch notification history:", err);
    } finally {
      setLoadingNotificationHistory(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotificationHistory();
  }, [fetchNotificationHistory]);

  return (
    <div className="space-y-6">
      {/* Notification History Inline Table */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10 py-4 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Notification History
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Email and alert delivery status for cost, token, and error alarms.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNotificationHistory}
              disabled={loadingNotificationHistory}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 gap-1.5"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  loadingNotificationHistory && "animate-spin"
                )}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingNotificationHistory ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              <span className="text-xs font-bold text-slate-500">
                Retrieving alert deliveries...
              </span>
            </div>
          ) : notificationHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-900/50 dark:text-slate-500 mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">
                No alert deliveries
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                History is recorded whenever an AI Observability cost, token, or error alarm is dispatched.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30 font-bold text-slate-400 dark:border-slate-800/60 dark:bg-slate-900/5">
                    <th className="px-6 py-3">Alert</th>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3">Delivery Channels</th>
                    <th className="px-6 py-3">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                  {notificationHistory.map((notif) => {
                    let severityColor =
                      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400";
                    if (notif.severity === "critical") {
                      severityColor =
                        "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300";
                    } else if (notif.severity === "high") {
                      severityColor =
                        "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400";
                    } else if (notif.severity === "medium") {
                      severityColor =
                        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400";
                    }
                    const channelConfig = [
                      {
                        name: "Email",
                        icon: Mail,
                        status: notif.channels?.email?.status,
                      },
                      {
                        name: "Slack",
                        icon: MessageSquare,
                        status: notif.channels?.slack?.status,
                      },
                      {
                        name: "Webhook",
                        icon: Cloud,
                        status: notif.channels?.webhook?.status,
                      },
                    ];
                    return (
                      <tr
                        key={notif._id}
                        className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5"
                      >
                        <td className="px-6 py-4 max-w-[220px]">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5 line-clamp-2">
                            {notif.message}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 border rounded text-[9.5px] font-bold uppercase ${severityColor}`}
                          >
                            {notif.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {channelConfig.map((ch) => {
                              const IconComponent = ch.icon;
                              let channelBadgeColor = "bg-slate-100 text-slate-400";
                              if (ch.status === "sent") {
                                channelBadgeColor =
                                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
                              } else if (ch.status === "failed") {
                                channelBadgeColor =
                                  "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
                              }
                              return (
                                <span
                                  key={ch.name}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold ${channelBadgeColor}`}
                                  title={`${ch.name}: ${ch.status}`}
                                >
                                  <IconComponent className="h-3 w-3" />
                                  {ch.name}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="text-slate-900 dark:text-white font-bold block"
                            title={new Date(notif.createdAt).toLocaleString()}
                          >
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">
                            {new Intl.DateTimeFormat("en", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            }).format(new Date(notif.createdAt))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cloud Actions Link */}
      <SettingRow
        href="/actions"
        icon={Cloud}
        title="Cloud actions"
        body="Recent deployment, simulation, and live-action audit events."
        status="live"
      />
    </div>
  );
}
