import { NotificationHistory } from "../models";

export async function getNotificationHistory(userId: string) {
  return NotificationHistory.find({ userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
}

export interface LogNotificationParams {
  userId: string;
  title: string;
  message: string;
  severity?: string;
  channels: {
    email: { status: "sent" | "failed" | "not_configured"; error?: string };
    slack: { status: "sent" | "failed" | "not_configured"; error?: string };
    webhook: { status: "sent" | "failed" | "not_configured"; error?: string };
  };
}

export async function logNotification(params: LogNotificationParams) {
  return NotificationHistory.create({
    userId: params.userId,
    title: params.title,
    message: params.message,
    severity: params.severity || "medium",
    channels: params.channels,
  });
}
