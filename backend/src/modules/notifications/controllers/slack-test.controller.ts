import { Request, Response } from "express";
import { User, decryptKey } from "../../../models/user.model";
import { logger } from "../../../core/logger";
import { ok, fail } from "../../../shared/responses";

function getUserId(req: Request): string {
  return (req as any).user.userId;
}

export async function testSlackNotificationHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const { webhookUrl, type } = req.body || {};

    let slackUrl: string | undefined;

    if (webhookUrl) {
      const cleanUrl = webhookUrl.trim();
      if (!cleanUrl.startsWith("https://hooks.slack.com/services/")) {
        res.status(400).json(fail("Slack webhook URL must start with https://hooks.slack.com/services/"));
        return;
      }
      slackUrl = cleanUrl;
    } else {
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json(fail("User not found"));
        return;
      }
      if (user.notificationSettings?.slack?.webhookUrl) {
        slackUrl = decryptKey(user.notificationSettings.slack.webhookUrl);
      }
    }

    if (!slackUrl) {
      res.status(400).json(fail("No Slack webhook URL configured"));
      return;
    }

    let text = "🧪 Test connection from Cloudcam! Notifications are successfully connected.";
    let blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🧪 *Test connection from Cloudcam!*\nYour Slack webhook is successfully configured to receive notifications from Cloudcam.",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Environment:* ${process.env.NODE_ENV || "development"} | *Sent At:* ${new Date().toUTCString()}`,
          },
        ],
      },
    ];

    if (type === "weekly_summary") {
      text = "ℹ️ Test weekly summary preview from Cloudcam!";
      blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "ℹ️ *AI Weekly Insights (Mock Preview)*\nWeekly AI Summary (2026-05-27 → 2026-06-03):\n- *12,450* requests | *$145.20* spend | *3,450,000* tokens\n- *3 insights found*:\n  • 🔴 *[HIGH]* Idle EC2 Instance: `i-09ab12cd` is averaging <1% CPU. Est. savings: $45.00/mo.\n  • 🟡 *[MEDIUM]* Unused RDS Database: `db-prod-replica` has 0 active connections.\n  • 🔵 *[LOW]* Optimize Model Ingestion: Switch system prompt configurations.",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `*Preview Triggered At:* ${new Date().toUTCString()}`,
            },
          ],
        },
      ];
    }

    const resSlack = await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Cloudcam",
        icon_url: "https://cdn-icons-png.flaticon.com/512/825/825590.png",
        text,
        blocks,
      }),
    });

    if (!resSlack.ok) {
      const errorText = await resSlack.text();
      res.status(400).json(fail(`Slack returned error: ${errorText || resSlack.statusText}`));
      return;
    }

    res.json(ok({ message: "Test Slack message sent successfully" }));
  } catch (error: any) {
    logger.error(`[Slack-Test-Controller] Test notification failed: ${error.message}`);
    res.status(500).json(fail(error));
  }
}
