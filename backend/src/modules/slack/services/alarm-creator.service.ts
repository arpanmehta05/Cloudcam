/* eslint-disable import/no-restricted-paths */
import { createVpsAlarmRule } from "../../vps-logs/services";
import { postSlackMessage } from "./interactive.service";
import { executeCloudAlarmCreation } from "./cloud-alarm-creator.service";
import { ParsedAlarmResult } from "./nlp-parser.service";

export async function executeAlarmCreation(params: {
  userId: string;
  parsed: ParsedAlarmResult;
  botToken: string;
  channelId: string;
  threadTs?: string;
}): Promise<void> {
  const { userId, parsed, botToken, channelId, threadTs } = params;

  const destination = parsed.destination || "vps_agent";
  const agentIdRaw = parsed.agentId || "all";
  const metric = parsed.metric;
  const comparator = parsed.comparator || "gte";
  const threshold = parsed.threshold;
  const severity = parsed.severity || "warning";
  const name = parsed.name || `Slack Alarm: ${metric || "Log Alert"}`;
  const windowMinutes = parsed.windowMinutes || 15;
  const cooldownMinutes = parsed.cooldownMinutes || 30;

  const source = parsed.source || "all";
  const service = parsed.service || "";
  const level = parsed.level || "error";
  const messagePattern = parsed.messagePattern || "";

  if (threshold === undefined || isNaN(threshold) || threshold <= 0) {
    await postSlackMessage({
      botToken,
      channelId,
      text: `⚠️ *Creation Failed:* Please provide a valid threshold value.`,
      threadTs,
    });
    return;
  }

  // Parse server prefix (vps_, aws_, azure_, gcp_) and target region
  let provider: "aws" | "azure" | "gcp" = "aws";
  let region = "ap-south-1";
  let agentId = agentIdRaw;

  if (agentIdRaw.startsWith("aws_")) {
    provider = "aws";
    const parts = agentIdRaw.substring(4).split("_");
    if (parts.length >= 2) {
      region = parts[0];
      agentId = parts.slice(1).join("_");
    } else {
      agentId = parts[0];
    }
  } else if (agentIdRaw.startsWith("azure_")) {
    provider = "azure";
    const parts = agentIdRaw.substring(6).split("_");
    if (parts.length >= 2) {
      region = parts[0];
      agentId = parts.slice(1).join("_");
    } else {
      agentId = parts[0];
    }
  } else if (agentIdRaw.startsWith("gcp_")) {
    provider = "gcp";
    const parts = agentIdRaw.substring(4).split("_");
    if (parts.length >= 2) {
      region = parts[0];
      agentId = parts.slice(1).join("_");
    } else {
      agentId = parts[0];
    }
  } else if (agentIdRaw.startsWith("vps_")) {
    agentId = agentIdRaw.substring(4);
  }

  if (destination === "cloud_native") {
    if (agentIdRaw === "all") {
      await postSlackMessage({
        botToken,
        channelId,
        text: `⚠️ *Creation Failed:* Cloud-native alarms require a specific VM or database target, you cannot select "All Servers".`,
        threadTs,
      });
      return;
    }

    await executeCloudAlarmCreation({
      userId,
      parsed,
      botToken,
      channelId,
      threadTs,
      provider,
      region,
      agentId,
    });
  } else {
    // Create VPS alarm rule
    const isLogVolume = parsed.type === "log_volume";
    const createdAlarm = await createVpsAlarmRule(userId, {
      name: name,
      type: isLogVolume ? "log_volume" : "metric_threshold",
      metric: isLogVolume ? undefined : (metric as any),
      comparator: (comparator || "gte") as any,
      threshold,
      agentId: agentId || "all",
      windowMinutes,
      cooldownMinutes,
      severity: (severity || "warning") as any,
      source: isLogVolume ? (source || "all") : undefined,
      service: isLogVolume ? (service || "") : undefined,
      level: isLogVolume ? (level || "error") : undefined,
      messagePattern: isLogVolume ? (messagePattern || "") : undefined,
    });

    // Post confirmation success message blocks
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *VPS Alarm Created Successfully!*\nI've configured the rule in your CloudWatcher workspace.`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Name:*\n${createdAlarm.name}` },
          {
            type: "mrkdwn",
            text: `*Type:*\n${
              createdAlarm.type === "log_volume" ? "Log Volume" : "Metric Threshold"
            }`,
          },
          { type: "mrkdwn", text: `*Metric:*\n${createdAlarm.metric || "log volume"}` },
          {
            type: "mrkdwn",
            text: `*Threshold:*\n${
              createdAlarm.comparator === "gte" ? ">=" : createdAlarm.comparator
            } ${createdAlarm.threshold}`,
          },
          { type: "mrkdwn", text: `*Agent ID:*\n\`${createdAlarm.agentId}\`` },
          { type: "mrkdwn", text: `*Severity:*\n${createdAlarm.severity.toUpperCase()}` },
        ],
      },
    ];

    if (isLogVolume) {
      blocks[1].fields!.push(
        { type: "mrkdwn", text: `*Source:*\n${createdAlarm.source || "all"}` },
        { type: "mrkdwn", text: `*Service:*\n${createdAlarm.service || "all"}` },
        { type: "mrkdwn", text: `*Level:*\n${createdAlarm.level || "error"}` },
        {
          type: "mrkdwn",
          text: `*Pattern:*\n${
            createdAlarm.messagePattern ? `\`${createdAlarm.messagePattern}\`` : "none"
          }`,
        }
      );
    }

    await postSlackMessage({
      botToken,
      channelId,
      text: `✅ VPS Alarm created: ${createdAlarm.name}`,
      threadTs,
      blocks,
    });
  }
}
