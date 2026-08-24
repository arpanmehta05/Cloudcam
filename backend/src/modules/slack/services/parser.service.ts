/* eslint-disable import/no-restricted-paths */
import mongoose from "mongoose";
import { SlackActiveSession } from "../models/slack-session.model";
import { User, decryptKey } from "../../../models/user.model";
import { getCredentials } from "../../../store/workspace-credentials";
import { getAlarmResources } from "../../aws/services/alarm/alarm-metadata.service";
import { getEnabledDiscoveryRegions } from "../../aws/providers/resources.provider";
import { getResources as getAzureResources } from "../../../services/azure/resources.service";
import { getResources as getGcpResources } from "../../../services/gcp/resources.service";
import { hashResourceId } from "../../../shared/crypto/hash";
import { logger } from "../../../core/logger";
import { parseAlarmQuery, mergeThreadReply, ParsedAlarmResult } from "./nlp-parser.service";
import { getUserAvailableResources } from "./resource-lister.service";
import { executeAlarmCreation } from "./alarm-creator.service";
import { postSlackMessage } from "./interactive.service";

export async function handleSlackEvent(
  event: any,
  rawBody: string,
  matchedUserId?: string
): Promise<void> {
  const text = event.text as string;
  const channelId = event.channel as string;
  const slackUserId = event.user as string;
  const threadTs = event.thread_ts || (event.ts as string);

  // 1. Resolve CloudWatcher User based on Slack mapping
  let user = await User.findOne({
    "notificationSettings.slack.slackUserMappings.slackUserId": slackUserId,
  });

  if (!user && matchedUserId) {
    const potentialUser = await User.findById(matchedUserId);
    if (potentialUser && potentialUser.notificationSettings?.slack) {
      if (!potentialUser.notificationSettings.slack.slackUserMappings) {
        potentialUser.notificationSettings.slack.slackUserMappings = [];
      }
      potentialUser.notificationSettings.slack.slackUserMappings.push({
        slackUserId,
        linkedAt: new Date(),
      });
      await potentialUser.save();
      logger.info(
        `[Slack-Bot] Auto-linked Slack User ID ${slackUserId} to user ${potentialUser.email} via signature match`
      );
      user = potentialUser;
    }
  }

  if (!user) {
    const allUsers = await User.find({});
    if (allUsers.length === 1) {
      const soleUser = allUsers[0];
      if (soleUser.notificationSettings?.slack) {
        if (!soleUser.notificationSettings.slack.slackUserMappings) {
          soleUser.notificationSettings.slack.slackUserMappings = [];
        }
        soleUser.notificationSettings.slack.slackUserMappings.push({
          slackUserId,
          linkedAt: new Date(),
        });
        await soleUser.save();
        logger.info(
          `[Slack-Bot] Auto-linked Slack User ID ${slackUserId} to the sole user ${soleUser.email}`
        );
        user = soleUser;
      }
    }
  }

  if (!user) {
    const defaultUser = await User.findOne({
      "notificationSettings.slack.botToken": { $ne: null },
    });

    if (!defaultUser || !defaultUser.notificationSettings?.slack?.botToken) {
      logger.warn("[Slack-Bot] No user found with configured Slack Bot Token");
      return;
    }

    const botToken = decryptKey(defaultUser.notificationSettings.slack.botToken);
    const textReply = `👋 Hi! I received your command, but your Slack account is not linked to a CloudWatcher account yet. Please link your account in the *Profile Settings* page.`;
    await postSlackMessage({ botToken, channelId, text: textReply, threadTs });
    return;
  }

  const botToken = decryptKey(user.notificationSettings!.slack!.botToken!);

  // Handle clean command request for interactive menu form
  const cleanText = text.replace(/<@[A-Z0-9]+>/g, "").trim().toLowerCase();
  if (cleanText === "create" || cleanText === "menu" || cleanText === "setup") {
    const agents = await mongoose.connection
      .collection("vpsagents")
      .find({ userId: user._id.toString() })
      .toArray();
    const serverOptions: any[] = [
      {
        text: { type: "plain_text", text: "All Servers" },
        value: "all",
      },
    ];

    // 1. VPS Agents
    agents.forEach((a) => {
      serverOptions.push({
        text: { type: "plain_text", text: `[VPS Agent] ${a.hostname || a.agentId}` },
        value: `vps_${a.agentId}`,
      });
    });

    // 2. AWS EC2 Instances
    try {
      const creds = await getCredentials(user._id.toString(), "aws");
      if (creds && creds.roleArn) {
        const regions = await getEnabledDiscoveryRegions(
          user._id.toString(),
          creds.roleArn,
          creds.externalId
        );
        const resourcesPromises = regions.map(async (region) => {
          try {
            const res = await getAlarmResources(
              user._id.toString(),
              "ec2",
              region,
              creds.roleArn,
              creds.externalId
            );
            return (res.resources || []).map((r) => ({
              label: `${r.label} (${region})`,
              value: r.value,
              region,
            }));
          } catch (err: any) {
            logger.warn(`[Slack-Bot] Failed to fetch EC2 resources for region ${region}: ${err.message}`);
            return [];
          }
        });
        const results = await Promise.allSettled(resourcesPromises);
        results.forEach((res) => {
          if (res.status === "fulfilled" && res.value) {
            res.value.forEach((inst) => {
              serverOptions.push({
                text: { type: "plain_text", text: `[AWS EC2] ${inst.label}` },
                value: `aws_${inst.region}_${inst.value}`,
              });
            });
          }
        });
      }
    } catch (err: any) {
      logger.warn(`[Slack-Bot] Failed to fetch AWS resources for slack menu: ${err.message}`);
    }

    // 3. Azure VMs
    try {
      const creds = await getCredentials(user._id.toString(), "azure");
      if (creds && creds.tenantId && creds.subscriptionId) {
        const inventory = await getAzureResources(
          user._id.toString(),
          "all",
          creds.tenantId,
          creds.subscriptionId,
          creds.clientId,
          creds.clientSecret
        );
        const vms = inventory.ec2 || [];
        vms.forEach((vm) => {
          const vmRegion = vm.region || "global";
          const label = vm.name || vm.id?.split("/").pop() || "Unnamed Resource";
          serverOptions.push({
            text: { type: "plain_text", text: `[Azure VM] ${label} (${vmRegion})` },
            value: `azure_${vmRegion}_${hashResourceId(vm.id)}`,
          });
        });
      }
    } catch (err: any) {
      logger.warn(`[Slack-Bot] Failed to fetch Azure resources for slack menu: ${err.message}`);
    }

    // 4. GCP VMs
    try {
      const creds = await getCredentials(user._id.toString(), "gcp");
      if (creds && creds.projectId && creds.clientEmail) {
        const inventory = await getGcpResources(
          user._id.toString(),
          "all",
          creds.projectId,
          creds.clientEmail,
          creds.privateKey
        );
        const instances = inventory.ec2 || [];
        instances.forEach((inst) => {
          const instRegion = inst.region || "global";
          serverOptions.push({
            text: { type: "plain_text", text: `[GCP VM] ${inst.name} (${instRegion})` },
            value: `gcp_${instRegion}_${hashResourceId(inst.id)}`,
          });
        });
      }
    } catch (err: any) {
      logger.warn(`[Slack-Bot] Failed to fetch GCP resources for slack menu: ${err.message}`);
    }

    const finalServerOptions = serverOptions.slice(0, 100);

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Create a new CloudWatch or VPS Alarm Rule by filling out the details below:",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_name_block",
        element: {
          type: "plain_text_input",
          action_id: "slack_alarm_name_input",
          placeholder: {
            type: "plain_text",
            text: "Enter alarm name (e.g. High CPU Alert)",
          },
        },
        label: {
          type: "plain_text",
          text: "Alarm Name",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_destination_block",
        element: {
          type: "static_select",
          action_id: "slack_alarm_destination_select",
          placeholder: {
            type: "plain_text",
            text: "Select Destination",
          },
          options: [
            { text: { type: "plain_text", text: "Cloud-Native (AWS, Azure, GCP)" }, value: "cloud_native" },
            { text: { type: "plain_text", text: "VPS Agent (Local Dashboard)" }, value: "vps_agent" },
          ],
          initial_option: { text: { type: "plain_text", text: "VPS Agent (Local Dashboard)" }, value: "vps_agent" },
        },
        label: {
          type: "plain_text",
          text: "Alarm Destination",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_agent_block",
        element: {
          type: "static_select",
          action_id: "slack_alarm_agent_select",
          placeholder: {
            type: "plain_text",
            text: "Select Server / Resource",
          },
          options: finalServerOptions,
          initial_option: {
            text: { type: "plain_text", text: "All Servers" },
            value: "all",
          },
        },
        label: {
          type: "plain_text",
          text: "Server / Resource",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_metric_block",
        element: {
          type: "static_select",
          action_id: "slack_alarm_metric_select",
          placeholder: {
            type: "plain_text",
            text: "Select Metric",
          },
          options: [
            { text: { type: "plain_text", text: "CPU Usage (%)" }, value: "cpuPercent" },
            { text: { type: "plain_text", text: "Memory Usage (%)" }, value: "ramPercent" },
            { text: { type: "plain_text", text: "Disk Usage (%)" }, value: "diskUsedPercent" },
            { text: { type: "plain_text", text: "Log Volume (count)" }, value: "log_volume" },
          ],
          initial_option: { text: { type: "plain_text", text: "CPU Usage (%)" }, value: "cpuPercent" },
        },
        label: {
          type: "plain_text",
          text: "Metric",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_comparator_block",
        element: {
          type: "static_select",
          action_id: "slack_alarm_comparator_select",
          placeholder: {
            type: "plain_text",
            text: "Select Operator",
          },
          options: [
            { text: { type: "plain_text", text: "Greater than or equal (>=)" }, value: "gte" },
            { text: { type: "plain_text", text: "Greater than (>)" }, value: "gt" },
            { text: { type: "plain_text", text: "Less than or equal (<=)" }, value: "lte" },
            { text: { type: "plain_text", text: "Less than (<)" }, value: "lt" },
          ],
          initial_option: { text: { type: "plain_text", text: "Greater than or equal (>=)" }, value: "gte" },
        },
        label: {
          type: "plain_text",
          text: "Operator",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_threshold_block",
        element: {
          type: "plain_text_input",
          action_id: "slack_alarm_threshold_input",
          placeholder: {
            type: "plain_text",
            text: "Enter value (e.g. 80)",
          },
        },
        label: {
          type: "plain_text",
          text: "Threshold Value",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_window_block",
        element: {
          type: "plain_text_input",
          action_id: "slack_alarm_window_input",
          placeholder: {
            type: "plain_text",
            text: "Evaluation window in minutes (e.g. 15)",
          },
          initial_value: "15",
        },
        label: {
          type: "plain_text",
          text: "Evaluation Window (Minutes)",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_cooldown_block",
        element: {
          type: "plain_text_input",
          action_id: "slack_alarm_cooldown_input",
          placeholder: {
            type: "plain_text",
            text: "Cooldown period in minutes (e.g. 30)",
          },
          initial_value: "30",
        },
        label: {
          type: "plain_text",
          text: "Cooldown Period (Minutes)",
        },
      },
      {
        type: "input",
        block_id: "slack_alarm_source_block",
        element: {
          type: "static_select",
          action_id: "slack_alarm_source_select",
          placeholder: {
            type: "plain_text",
            text: "Select Source",
          },
          options: [
            { text: { type: "plain_text", text: "All Sources" }, value: "all" },
            { text: { type: "plain_text", text: "Docker" }, value: "docker" },
            { text: { type: "plain_text", text: "PM2" }, value: "pm2" },
            { text: { type: "plain_text", text: "Nginx" }, value: "nginx" },
            { text: { type: "plain_text", text: "Apache" }, value: "apache" },
            { text: { type: "plain_text", text: "System" }, value: "system" },
          ],
          initial_option: { text: { type: "plain_text", text: "All Sources" }, value: "all" },
        },
        label: {
          type: "plain_text",
          text: "Log Source (Log Volume alarms only)",
        },
        optional: true,
      },
      {
        type: "input",
        block_id: "slack_alarm_service_block",
        element: {
          type: "plain_text_input",
          action_id: "slack_alarm_service_input",
          placeholder: {
            type: "plain_text",
            text: "Enter service or container name (e.g. nginx-access)",
          },
        },
        label: {
          type: "plain_text",
          text: "Service Name (Log Volume alarms only)",
        },
        optional: true,
      },
      {
        type: "input",
        block_id: "slack_alarm_level_block",
        element: {
          type: "static_select",
          action_id: "slack_alarm_level_select",
          placeholder: {
            type: "plain_text",
            text: "Select Log Level",
          },
          options: [
            { text: { type: "plain_text", text: "All Levels" }, value: "all" },
            { text: { type: "plain_text", text: "Error" }, value: "error" },
            { text: { type: "plain_text", text: "Warning" }, value: "warn" },
            { text: { type: "plain_text", text: "Info" }, value: "info" },
            { text: { type: "plain_text", text: "Debug" }, value: "debug" },
          ],
          initial_option: { text: { type: "plain_text", text: "Error" }, value: "error" },
        },
        label: {
          type: "plain_text",
          text: "Log Level (Log Volume alarms only)",
        },
        optional: true,
      },
      {
        type: "input",
        block_id: "slack_alarm_pattern_block",
        element: {
          type: "plain_text_input",
          action_id: "slack_alarm_pattern_input",
          placeholder: {
            type: "plain_text",
            text: "Filter message text (e.g., timeout)",
          },
        },
        label: {
          type: "plain_text",
          text: "Message Pattern Keyword (Log Volume alarms only)",
        },
        optional: true,
      },
      {
        type: "input",
        block_id: "slack_alarm_severity_block",
        element: {
          type: "static_select",
          action_id: "slack_alarm_severity_select",
          placeholder: {
            type: "plain_text",
            text: "Select Severity",
          },
          options: [
            { text: { type: "plain_text", text: "Warning" }, value: "warning" },
            { text: { type: "plain_text", text: "Critical" }, value: "critical" },
            { text: { type: "plain_text", text: "Info" }, value: "info" },
          ],
          initial_option: { text: { type: "plain_text", text: "Warning" }, value: "warning" },
        },
        label: {
          type: "plain_text",
          text: "Severity",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: "slack_create_alarm_submit",
            text: {
              type: "plain_text",
              text: "Create Alarm",
            },
            style: "primary",
            value: "submit",
          },
        ],
      },
    ];
    await postSlackMessage({
      botToken,
      channelId,
      text: "Create a new alarm using the interactive menu:",
      threadTs,
      blocks,
    });
    return;
  }

  // 2. Check for active threaded session
  let session = await SlackActiveSession.findOne({ channelId, threadTs });
  let parsed: ParsedAlarmResult;
  let missingFields: string[] = [];

  const availableResources = await getUserAvailableResources(user._id.toString());

  if (session) {
    const mergeResult = await mergeThreadReply({
      pendingAlarm: session.pendingAlarm,
      missingFields: session.missingFields,
      replyText: text,
      availableResources,
    });
    parsed = mergeResult.parsed;
    missingFields = mergeResult.missingFields;
  } else {
    const parseResult = await parseAlarmQuery(text, availableResources);
    parsed = parseResult.parsed;
    missingFields = parseResult.missingFields;
  }

  // 3. Process result
  if (missingFields.length > 0) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL
    if (session) {
      session.pendingAlarm = parsed;
      session.missingFields = missingFields;
      session.expiresAt = expiresAt;
      await session.save();
    } else {
      session = await SlackActiveSession.create({
        slackUserId,
        channelId,
        threadTs,
        pendingAlarm: parsed,
        missingFields,
        expiresAt,
      });
    }

    // Ask for the first missing field
    let promptText = "I need some details to set up your alarm:";
    const nextField = missingFields[0];
    if (nextField === "threshold") {
      promptText = `🔢 *What is the threshold value* for the alarm? (e.g. \`80\` for 80% CPU usage)`;
    } else if (nextField === "type") {
      promptText = `⚙️ *What type of alarm rule* should this be? (\`metric_threshold\` for resource usage, or \`log_volume\` for log rates)`;
    } else if (nextField === "metric") {
      promptText = `📊 *Which metric* would you like to monitor? (\`cpuPercent\`, \`ramPercent\`, or \`diskUsedPercent\`)`;
    } else if (nextField === "agentId") {
      promptText = `🖥️ *Which server or instance* should this alarm target? (e.g. \`all\` or specify the server name/ID)`;
    } else if (nextField === "destination") {
      promptText = `☁️ *Where should this alarm be created?* (\`cloud_native\` for cloud providers or \`vps_agent\` for your local agents)`;
    }

    await postSlackMessage({
      botToken,
      channelId,
      text: promptText,
      threadTs,
    });
  } else {
    // Create alarm
    try {
      await executeAlarmCreation({
        userId: user._id.toString(),
        parsed,
        botToken,
        channelId,
        threadTs,
      });

      // Clean up session
      if (session) {
        await SlackActiveSession.deleteOne({ _id: session._id });
      }
    } catch (err: any) {
      logger.error(`[Slack-Bot] Error creating alarm: ${err.message}`);
      await postSlackMessage({
        botToken,
        channelId,
        text: `❌ *Error creating alarm:* ${err.message || "Internal rule creation error"}`,
        threadTs,
      });
    }
  }
}
