import { User, decryptKey } from "../../../models/user.model";
import { VpsAlertPolicy } from "../models/vps-alert-policy.model";
import { VpsLogAlert } from "../models/vps-log-alert.model";
import { VpsLogEntry } from "../models/vps-log-entry.model";
import { IVpsAlarmRule, VpsAlarmRule, VpsAlarmComparator } from "../models/vps-alarm-rule.model";
import { sendEmail } from "../../../services/email.service";
import { logger } from "../../../core/logger";

export interface StoredVpsLogEntry {
  userId: string;
  agentId: string;
  source: string;
  service: string;
  level: string;
  message: string;
  timestamp: string;
  errorSignature?: string;
}

export interface VpsErrorBurstAlertResult {
  signature: string;
  count: number;
  threshold: number;
  emailSent: boolean;
  recipient?: string;
  skippedReason?: string;
  error?: string;
}

const ERROR_ALERT_THRESHOLD = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_THRESHOLD || "25", 10));
const ERROR_ALERT_WINDOW_MINUTES = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_WINDOW_MINUTES || "15", 10));
const ERROR_ALERT_COOLDOWN_MINUTES = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_COOLDOWN_MINUTES || "60", 10));

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function describeComparator(comparator: VpsAlarmComparator): string {
  if (comparator === "gt") return ">";
  if (comparator === "lte") return "<=";
  if (comparator === "lt") return "<";
  return ">=";
}

export async function sendVpsErrorBurstAlerts(
  agent: any,
  entries: StoredVpsLogEntry[]
): Promise<VpsErrorBurstAlertResult[]> {
  const results: VpsErrorBurstAlertResult[] = [];
  const errorEntries = entries.filter((entry) => entry.level === "error" && entry.errorSignature);
  if (!errorEntries.length) return results;

  const bySignature = new Map<string, StoredVpsLogEntry[]>();
  for (const entry of errorEntries) {
    const signature = entry.errorSignature!;
    if (!bySignature.has(signature)) bySignature.set(signature, []);
    bySignature.get(signature)!.push(entry);
  }

  const user = await User.findById(agent.userId).lean();
  if (!user?.email) {
    for (const signature of bySignature.keys()) {
      results.push({
        signature,
        count: 0,
        threshold: ERROR_ALERT_THRESHOLD,
        emailSent: false,
        skippedReason: "account_holder_email_not_found",
      });
    }
    return results;
  }

  const policy = (await VpsAlertPolicy.findOne({ userId: agent.userId }).lean()) || {
    errorSignatureThreshold: ERROR_ALERT_THRESHOLD,
    windowMinutes: ERROR_ALERT_WINDOW_MINUTES,
    cooldownMinutes: ERROR_ALERT_COOLDOWN_MINUTES,
  };

  const windowStart = new Date(Date.now() - policy.windowMinutes * 60 * 1000);
  const cooldownStart = new Date(Date.now() - policy.cooldownMinutes * 60 * 1000);
  const threshold = policy.errorSignatureThreshold;

  for (const [signature, signatureEntries] of bySignature) {
    const sample = signatureEntries[signatureEntries.length - 1];
    const recentCount = await VpsLogEntry.countDocuments({
      userId: agent.userId,
      agentId: agent.agentId,
      level: "error",
      errorSignature: signature,
      timestamp: { $gte: windowStart },
    });

    if (recentCount < threshold) {
      results.push({
        signature,
        count: recentCount,
        threshold,
        emailSent: false,
        recipient: user.email,
        skippedReason: "below_threshold",
      });
      continue;
    }

    const previousAlert = await VpsLogAlert.findOne({
      userId: agent.userId,
      agentId: agent.agentId,
      errorSignature: signature,
      lastSentAt: { $gte: cooldownStart },
    }).lean();

    if (previousAlert) {
      results.push({
        signature,
        count: recentCount,
        threshold,
        emailSent: false,
        recipient: user.email,
        skippedReason: "cooldown_active",
      });
      continue;
    }

    const subject = `VPS error burst detected: ${sample.service || "unknown service"}`;
    const html = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
            <h2 style="margin-bottom: 8px;">VPS error burst detected</h2>
            <p>Cloudcam detected a heavy burst of repeated error logs for one of your VPS agents.</p>
            <table style="border-collapse: collapse; margin: 20px 0; width: 100%; max-width: 640px;">
                <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Agent</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${escapeHtml(
                  agent.name || agent.agentId
                )}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Service</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${escapeHtml(
                  sample.service || "unknown"
                )}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Source</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${escapeHtml(
                  sample.source
                )}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Repeated errors</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${recentCount} in the last ${
      policy.windowMinutes
    } minutes</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Signature</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${escapeHtml(
                  signature
                )}</td></tr>
            </table>
            <p><strong>Recent sample</strong></p>
            <pre style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">${escapeHtml(
              sample.message.slice(0, 1000)
            )}</pre>
            <p>Please open the VPS Logs page and inspect this service.</p>
        </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject,
        html,
      });

      await VpsLogAlert.findOneAndUpdate(
        { userId: agent.userId, agentId: agent.agentId, errorSignature: signature },
        {
          $set: {
            lastSentAt: new Date(),
            lastCount: recentCount,
            sample: sample.message.slice(0, 1000),
            service: sample.service,
            source: sample.source,
          },
        },
        { typeof: "after", upsert: true, new: true } as any
      );

      results.push({
        signature,
        count: recentCount,
        threshold,
        emailSent: true,
        recipient: user.email,
      });
    } catch (error: any) {
      results.push({
        signature,
        count: recentCount,
        threshold,
        emailSent: false,
        recipient: user.email,
        skippedReason: "email_send_failed",
        error: error?.message || "Unknown email error",
      });
    }
  }

  return results;
}

export async function sendVpsAlarmEmail(params: {
  userEmail: string;
  agent: any;
  rule: IVpsAlarmRule;
  value: number;
  sample?: StoredVpsLogEntry;
}) {
  const { userEmail, agent, rule, value, sample } = params;
  const subject = `Cloudcam ${rule.severity} alarm: ${rule.name}`;
  const comparator = describeComparator(rule.comparator);
  const unit = rule.type === "metric_threshold" ? "%" : "logs";
  const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">${escapeHtml(rule.name)} triggered</h2>
          <p>Cloudcam detected an alarm condition on your own logs and metrics collector.</p>
          <table style="border-collapse: collapse; margin: 20px 0; width: 100%; max-width: 640px;">
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Agent</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${escapeHtml(
                agent.name || agent.agentId
              )}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Severity</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${escapeHtml(
                rule.severity
              )}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Rule</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${escapeHtml(
                rule.type
              )} ${escapeHtml(rule.metric || rule.level || "logs")}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Observed</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${value.toFixed(
                2
              )} ${unit}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Threshold</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${comparator} ${
    rule.threshold
  } ${unit} over ${rule.windowMinutes} minutes</td></tr>
          </table>
          ${
            sample
              ? `<p><strong>Recent sample</strong></p><pre style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">${escapeHtml(
                  sample.message.slice(0, 1000)
                )}</pre>`
              : ""
          }
          <p>Open the VPS Logs page to inspect the collector, recent logs, and host metrics.</p>
      </div>
  `;

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendVpsAlarmSlack(params: {
  user: any;
  agent: any;
  rule: IVpsAlarmRule;
  value: number;
  sample?: StoredVpsLogEntry;
}) {
  const { user, agent, rule, value, sample } = params;
  const slackSettings = user.notificationSettings?.slack;
  if (!slackSettings || !slackSettings.enabled) return;

  const comparator = describeComparator(rule.comparator);
  const unit = rule.type === "metric_threshold" ? "%" : "logs";
  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    warning: "🟡",
    info: "🔵",
  };
  const emoji = severityEmoji[rule.severity || "warning"] || "⚠️";

  const title = `${emoji} *Alarm Triggered: ${rule.name}*`;
  const message = `Cloudcam detected an alarm condition on your Own Logs & Metrics VPS agent.\n\n*Agent:* ${
    agent.name || agent.agentId
  }\n*Metric:* ${rule.metric || rule.level || "logs"}\n*Observed:* ${value.toFixed(
    2
  )} ${unit}\n*Threshold:* ${comparator} ${rule.threshold} ${unit} over ${
    rule.windowMinutes
  } min`;

  if (slackSettings.webhookUrl) {
    try {
      const slackUrl = decryptKey(slackSettings.webhookUrl);
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Cloudcam",
          text: `*${title}*\n${message}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${title}*\n${message}`,
              },
            },
            ...(sample
              ? [
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: `*Recent Sample:*\n\`\`\`${sample.message.slice(
                        0,
                        500
                      )}\`\`\``,
                    },
                  },
                ]
              : []),
          ],
        }),
      });
      logger.info(
        `[vps-logs] Slack alert sent successfully via Webhook for alarm: ${rule.name}`
      );
    } catch (err) {
      logger.error("[vps-logs] Slack webhook alert failed:", err);
    }
  }

  if (slackSettings.botToken && slackSettings.slackUserMappings?.length > 0) {
    try {
      const { postSlackMessage } = require("../../../services/slack-alarm-parser.service");
      const botToken = decryptKey(slackSettings.botToken);
      for (const mapping of slackSettings.slackUserMappings) {
        if (mapping.slackUserId) {
          await postSlackMessage({
            botToken,
            channelId: mapping.slackUserId,
            text: `🚨 *${rule.name}* triggered on server *${
              agent.name || agent.agentId
            }*!`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${title}*\n${message}`,
                },
              },
              ...(sample
                ? [
                    {
                      type: "section",
                      text: {
                        type: "mrkdwn",
                        text: `*Recent Sample:*\n\`\`\`${sample.message.slice(
                          0,
                          500
                        )}\`\`\``,
                      },
                    },
                  ]
                : []),
            ],
          });
        }
      }
    } catch (err) {
      logger.error("[vps-logs] Slack Bot alert failed:", err);
    }
  }
}
