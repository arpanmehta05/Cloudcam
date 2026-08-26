import { User, decryptKey } from "../../../models/user.model";
import { logNotification } from "./history.service";
import { sendEmail } from "./email.service";
import { logger } from "../../../core/logger";

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  severity?: "low" | "medium" | "high" | "critical";
  type?: string;
  metadata?: Record<string, any>;
}

export interface DeliveryResult {
  email: boolean | null; // null = channel not configured
  slack: boolean | null;
  webhook: boolean | null;
}

async function sendEmailWebhook(payload: NotificationPayload): Promise<boolean> {
  const emailEndpoint = process.env.AI_OBS_EMAIL_WEBHOOK;
  if (!emailEndpoint) return false;

  try {
    const res = await fetch(emailEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: payload.userId, // In production: resolve userId → email via User model
        subject: `[Cloudcam AI] ${payload.title}`,
        body: payload.message,
        severity: payload.severity,
        metadata: payload.metadata,
      }),
    });
    return res.ok;
  } catch (err: any) {
    logger.error(`[AI-Notify] Email delivery failed: ${err.message}`);
    return false;
  }
}

async function sendSlackWebhook(
  payload: NotificationPayload,
  customWebhookUrl?: string
): Promise<boolean> {
  const slackUrl = customWebhookUrl || process.env.AI_OBS_SLACK_WEBHOOK;
  if (!slackUrl) return false;

  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
  };

  const emoji = severityEmoji[payload.severity || "medium"] || "ℹ️";

  try {
    const res = await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Cloudcam",
        icon_url: "https://cdn-icons-png.flaticon.com/512/825/825590.png",
        text: `${emoji} *${payload.title}*\n${payload.message}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *${payload.title}*\n${payload.message}`,
            },
          },
          ...(payload.metadata
            ? [
                {
                  type: "context",
                  elements: [
                    {
                      type: "mrkdwn",
                      text: Object.entries(payload.metadata)
                        .map(([k, v]) => `*${k}:* ${v}`)
                        .join(" | "),
                    },
                  ],
                },
              ]
            : []),
        ],
      }),
    });
    return res.ok;
  } catch (err: any) {
    logger.error(`[AI-Notify] Slack delivery failed: ${err.message}`);
    return false;
  }
}

async function sendGenericWebhook(payload: NotificationPayload): Promise<boolean> {
  const webhookUrl = process.env.AI_OBS_GENERIC_WEBHOOK;
  if (!webhookUrl) return false;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.AI_OBS_WEBHOOK_SECRET
          ? { "X-Webhook-Secret": process.env.AI_OBS_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        event: "ai_observability_alert",
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
    return res.ok;
  } catch (err: any) {
    logger.error(`[AI-Notify] Webhook delivery failed: ${err.message}`);
    return false;
  }
}

const getStatus = (val: boolean | null): "sent" | "failed" | "not_configured" => {
  if (val === null) return "not_configured";
  return val ? "sent" : "failed";
};

export async function notify(payload: NotificationPayload): Promise<DeliveryResult> {
  const user = await User.findById(payload.userId);
  let customSlackWebhook: string | undefined;
  let slackEnabled = true;
  let emailEnabled = true;

  if (user && user.notificationSettings) {
    slackEnabled = user.notificationSettings.slack?.enabled ?? false;
    emailEnabled = user.notificationSettings.email?.enabled ?? true;
    if (user.notificationSettings.slack?.webhookUrl) {
      try {
        customSlackWebhook = decryptKey(user.notificationSettings.slack.webhookUrl);
      } catch (err: any) {
        logger.error(`Failed to decrypt user Slack webhook URL: ${err.message}`);
      }
    }
  }

  const [emailResult, slackResult, webhookResult] = await Promise.allSettled([
    emailEnabled && process.env.AI_OBS_EMAIL_WEBHOOK ? sendEmailWebhook(payload) : Promise.resolve(null),
    slackEnabled && (customSlackWebhook || process.env.AI_OBS_SLACK_WEBHOOK)
      ? sendSlackWebhook(payload, customSlackWebhook)
      : Promise.resolve(null),
    process.env.AI_OBS_GENERIC_WEBHOOK ? sendGenericWebhook(payload) : Promise.resolve(null),
  ]);

  const result = {
    email: emailResult.status === "fulfilled" ? emailResult.value : false,
    slack: slackResult.status === "fulfilled" ? slackResult.value : false,
    webhook: webhookResult.status === "fulfilled" ? webhookResult.value : false,
  };

  try {
    await logNotification({
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      severity: payload.severity,
      channels: {
        email: { status: getStatus(result.email) },
        slack: { status: getStatus(result.slack) },
        webhook: { status: getStatus(result.webhook) },
      },
    });
  } catch (err: any) {
    logger.error(`[NotificationHistory] Failed to log notification delivery: ${err.message}`);
  }

  return result;
}

export async function notifyIfCritical(
  payload: NotificationPayload
): Promise<DeliveryResult | null> {
  const severity = payload.severity || "medium";
  if (severity === "critical" || severity === "high") {
    return notify(payload);
  }
  return null;
}
