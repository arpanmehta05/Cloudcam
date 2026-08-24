/* eslint-disable import/no-restricted-paths */
import { postSlackMessage } from "./interactive.service";
import { getCredentials } from "../../../store/workspace-credentials";
import { resolveCloudServer } from "./resource-lister.service";
import { getSnsTopics } from "../../aws/services/alarm/alarm-metadata.service";
import { createAlarm } from "../../aws/providers/alarms.provider";
import { putAzureMetricAlert, getAzureActionGroups } from "../../azure/providers/alerts.provider";
import { putGcpMetricAlert, getGcpNotificationChannels } from "../../gcp/providers/alerts.provider";
import { logger } from "../../../core/logger";
import { ParsedAlarmResult } from "./nlp-parser.service";

export async function executeCloudAlarmCreation(params: {
  userId: string;
  parsed: ParsedAlarmResult;
  botToken: string;
  channelId: string;
  threadTs?: string;
  provider: "aws" | "azure" | "gcp";
  region: string;
  agentId: string;
}): Promise<void> {
  const { userId, parsed, botToken, channelId, threadTs, provider, region, agentId } = params;
  const metric = parsed.metric;
  const comparator = parsed.comparator || "gte";
  const threshold = parsed.threshold!;
  const name = parsed.name || `Slack Alarm: ${metric || "Log Alert"}`;

  // Fetch credentials for parsed provider
  const creds = await getCredentials(userId, provider);
  if (!creds) {
    await postSlackMessage({
      botToken,
      channelId,
      text: `⚠️ *Creation Failed:* No connected credentials found for ${provider.toUpperCase()}. Please configure them in your settings first.`,
      threadTs,
    });
    return;
  }

  // Resolve hash to full resource ID for Azure/GCP
  let targetResourceId = agentId;
  let targetLabel = agentId;
  if (provider === "azure" || provider === "gcp") {
    const resolved = await resolveCloudServer(
      userId,
      provider,
      region,
      agentId,
      creds
    );
    if (!resolved) {
      await postSlackMessage({
        botToken,
        channelId,
        text: `⚠️ *Creation Failed:* Could not locate the selected ${provider.toUpperCase()} virtual machine in region \`${region}\`.`,
        threadTs,
      });
      return;
    }
    targetResourceId = resolved.id;
    targetLabel = resolved.label;
  }

  if (provider === "aws") {
    // AWS EC2 logic
    if (metric !== "cpuPercent") {
      await postSlackMessage({
        botToken,
        channelId,
        text: `⚠️ *AWS CloudWatch Warning:* CloudWatch does not natively monitor Memory or Disk usage without the AWS CloudWatch agent installed on your instance. For instant RAM/Disk monitoring, please create a *VPS Agent* alarm instead.`,
        threadTs,
      });
      return;
    }

    let snsTopicArn = "";
    try {
      const topics = await getSnsTopics(userId, region, creds.roleArn, creds.externalId);
      if (topics && topics.length > 0) {
        snsTopicArn = topics[0].value;
      }
    } catch (err: any) {
      logger.warn(`[Slack-Bot] Failed to query SNS topics: ${err.message}`);
    }

    if (!snsTopicArn) {
      await postSlackMessage({
        botToken,
        channelId,
        text: `⚠️ *Creation Failed:* No Amazon SNS Topics found in ${region}. AWS CloudWatch alarms require an SNS Topic for notifications. Please configure one in the AWS Console.`,
        threadTs,
      });
      return;
    }

    const comparisonMap: Record<string, string> = {
      gte: "GreaterThanOrEqualToThreshold",
      gt: "GreaterThanThreshold",
      lte: "LessThanOrEqualToThreshold",
      lt: "LessThanThreshold",
    };
    const comparison = comparisonMap[comparator] || "GreaterThanOrEqualToThreshold";

    const dimensions = [{ Name: "InstanceId", Value: agentId }];
    const cleanCustomName = name.replace(/[^a-zA-Z0-9-]/g, "-").substring(0, 100);
    const awsAlarmName = `rabbittwatch-${cleanCustomName}-${Date.now()}`.substring(0, 255);

    const alarmParams = {
      name: awsAlarmName,
      metric: "CPUUtilization",
      namespace: "AWS/EC2",
      threshold,
      comparison,
      period: 300,
      evaluationPeriods: 1,
      statistic: "Average",
      dimensions,
      actions: [snsTopicArn],
    };

    try {
      await createAlarm(userId, region, alarmParams as any, creds.roleArn, creds.externalId);
      const replyText =
        `✅ *AWS CloudWatch Alarm Created Successfully!*\n` +
        `*Alarm Name:* \`${awsAlarmName}\`\n` +
        `*Metric:* CPUUtilization (AWS/EC2)\n` +
        `*Operator:* ${comparator === "gte" ? ">=" : comparator} ${threshold}%\n` +
        `*Target Instance:* \`${agentId}\`\n` +
        `*Region:* \`${region}\`\n` +
        `*Notification Action:* \`${snsTopicArn.split(":").pop()}\``;

      await postSlackMessage({ botToken, channelId, text: replyText, threadTs });
    } catch (err: any) {
      logger.error(`[Slack-Bot] Failed to create CloudWatch alarm: ${err.message}`);
      await postSlackMessage({
        botToken,
        channelId,
        text: `❌ *AWS CloudWatch Alarm Creation Failed:* ${err?.message || "Internal AWS error"}`,
        threadTs,
      });
    }
  } else if (provider === "azure") {
    // Azure VM logic
    if (metric !== "cpuPercent") {
      await postSlackMessage({
        botToken,
        channelId,
        text: `⚠️ *Azure Warning:* Azure Monitor does not natively monitor VM OS Memory or Disk usage without the Log Analytics agent. For instant RAM/Disk monitoring, please create a *VPS Agent* alarm instead.`,
        threadTs,
      });
      return;
    }

    let actionGroupId = "";
    try {
      const actionGroups = await getAzureActionGroups(
        creds.tenantId!,
        creds.subscriptionId!,
        creds.clientId!,
        creds.clientSecret!,
        region
      );
      if (actionGroups && actionGroups.length > 0) {
        actionGroupId = actionGroups[0].value;
      }
    } catch (err: any) {
      logger.warn(`[Slack-Bot] Failed to query Azure action groups: ${err.message}`);
    }

    if (!actionGroupId) {
      await postSlackMessage({
        botToken,
        channelId,
        text: `⚠️ *Creation Failed:* No Azure Action Groups found in ${region}. Azure alarms require an Action Group for notifications.`,
        threadTs,
      });
      return;
    }

    const comparisonMap: Record<string, string> = {
      gte: "GreaterThanOrEqual",
      gt: "GreaterThan",
      lte: "LessThanOrEqual",
      lt: "LessThan",
    };
    const comparison = comparisonMap[comparator] || "GreaterThanOrEqual";

    const azureAlarmName = `rabbittwatch-slack-vm-${targetLabel}-cpu-${Date.now()}`.substring(0, 255);

    try {
      await putAzureMetricAlert(
        creds.tenantId!,
        creds.subscriptionId!,
        creds.clientId!,
        creds.clientSecret!,
        region,
        azureAlarmName,
        {
          name: azureAlarmName,
          metric: "Percentage CPU",
          threshold,
          comparison,
          period: 300,
          evaluationPeriods: 1,
          resourceId: targetResourceId,
          actions: [actionGroupId],
        }
      );
      const replyText =
        `✅ *Azure Metric Alert Created Successfully!*\n` +
        `*Alert Name:* \`${azureAlarmName}\`\n` +
        `*Metric:* Percentage CPU (Microsoft.Compute/virtualMachines)\n` +
        `*Operator:* ${comparator === "gte" ? ">=" : comparator} ${threshold}%\n` +
        `*Target VM:* \`${targetLabel}\`\n` +
        `*Region:* \`${region}\`\n` +
        `*Action Group:* \`${actionGroupId.split("/").pop()}\``;

      await postSlackMessage({ botToken, channelId, text: replyText, threadTs });
    } catch (err: any) {
      logger.error(`[Slack-Bot] Failed to create Azure alert: ${err.message}`);
      await postSlackMessage({
        botToken,
        channelId,
        text: `❌ *Azure Alert Rule Creation Failed:* ${err?.message || "Internal Azure error"}`,
        threadTs,
      });
    }
  } else if (provider === "gcp") {
    // GCP VM logic
    if (metric !== "cpuPercent") {
      await postSlackMessage({
        botToken,
        channelId,
        text: `⚠️ *GCP Warning:* GCP Cloud Monitoring does not natively monitor VM OS Memory or Disk usage without the Ops Agent installed. For instant RAM/Disk monitoring, please create a *VPS Agent* alarm instead.`,
        threadTs,
      });
      return;
    }

    let channelIdStr = "";
    try {
      const channels = await getGcpNotificationChannels(
        creds.projectId!,
        creds.clientEmail!,
        creds.privateKey!,
        region
      );
      if (channels && channels.length > 0) {
        channelIdStr = channels[0].value;
      }
    } catch (err: any) {
      logger.warn(`[Slack-Bot] Failed to query GCP notification channels: ${err.message}`);
    }

    if (!channelIdStr) {
      await postSlackMessage({
        botToken,
        channelId,
        text: `⚠️ *Creation Failed:* No GCP Notification Channels found. GCP alarms require a Notification Channel for alerts.`,
        threadTs,
      });
      return;
    }

    const comparisonMap: Record<string, string> = {
      gte: "GreaterThanOrEqual",
      gt: "GreaterThan",
      lte: "LessThanOrEqual",
      lt: "LessThan",
    };
    const comparison = comparisonMap[comparator] || "GreaterThanOrEqual";

    const gcpAlarmName = `rabbittwatch-slack-gcp-${targetLabel}-cpu-${Date.now()}`.substring(0, 255);
    const gcpThreshold = threshold / 100; // Fraction value for GCP CPU Utilization

    try {
      await putGcpMetricAlert(
        creds.projectId!,
        creds.clientEmail!,
        creds.privateKey!,
        region,
        gcpAlarmName,
        {
          name: gcpAlarmName,
          metric: "compute.googleapis.com/instance/cpu/utilization",
          threshold: gcpThreshold,
          comparison,
          period: 300,
          evaluationPeriods: 1,
          resourceId: targetResourceId,
          actions: [channelIdStr],
        }
      );
      const replyText =
        `✅ *GCP Alert Policy Created Successfully!*\n` +
        `*Policy Name:* \`${gcpAlarmName}\`\n` +
        `*Metric:* CPU Utilization (compute.googleapis.com/instance)\n` +
        `*Operator:* ${comparator === "gte" ? ">=" : comparator} ${threshold}%\n` +
        `*Target VM:* \`${targetLabel}\`\n` +
        `*Region:* \`${region}\`\n` +
        `*Notification Channel:* \`${channelIdStr.split("/").pop()}\``;

      await postSlackMessage({ botToken, channelId, text: replyText, threadTs });
    } catch (err: any) {
      logger.error(`[Slack-Bot] Failed to create GCP alert: ${err.message}`);
      await postSlackMessage({
        botToken,
        channelId,
        text: `❌ *GCP Alert Policy Creation Failed:* ${err?.message || "Internal GCP error"}`,
        threadTs,
      });
    }
  }
}
