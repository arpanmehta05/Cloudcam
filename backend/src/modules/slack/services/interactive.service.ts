import { verifyAndMatchSlackUser } from "./signature.service";
import { decryptKey } from "../../../models/user.model";
import { executeAlarmCreation } from "./alarm-creator.service";
import { logger } from "../../../core/logger";

export async function postSlackMessage(params: {
  botToken: string;
  channelId: string;
  text: string;
  threadTs?: string;
  blocks?: any[];
}): Promise<boolean> {
  const { botToken, channelId, text, threadTs, blocks } = params;
  try {
    const payload: Record<string, any> = {
      channel: channelId,
      text,
    };
    if (threadTs) payload.thread_ts = threadTs;
    if (blocks) payload.blocks = blocks;

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as any;
    if (!data.ok) {
      logger.error(`[Slack-Bot] Error posting message: ${data.error}`);
      return false;
    }
    return true;
  } catch (err: any) {
    logger.error(`[Slack-Bot] Failed to post message to Slack Web API: ${err.message}`);
    return false;
  }
}

function getStateValue(
  stateValues: any,
  actionKey: string
): string | undefined {
  if (!stateValues) return undefined;
  for (const blockId of Object.keys(stateValues)) {
    const block = stateValues[blockId];
    for (const actionId of Object.keys(block)) {
      const element = block[actionId];
      if (actionId === actionKey) {
        if (element.type === "plain_text_input") {
          return element.value;
        }
        if (element.type === "static_select" && element.selected_option) {
          return element.selected_option.value;
        }
      }
    }
  }
  return undefined;
}

export async function handleInteractiveCallback(params: {
  payloadStr: string;
  signature: string;
  timestamp: string;
  rawBodyText: string;
}): Promise<void> {
  const { payloadStr, signature, timestamp, rawBodyText } = params;

  // 1. Verify and match the user based on signature
  const matchedUser = await verifyAndMatchSlackUser({
    signature,
    timestamp,
    rawBodyText,
  });

  const payload = JSON.parse(payloadStr);
  const action = payload.actions?.[0];
  if (!action || action.action_id !== "slack_create_alarm_submit") {
    return; // Ignore other minor selection updates, only process form submits
  }

  const channelId = payload.channel?.id;
  const threadTs = payload.message?.thread_ts || payload.message?.ts;
  const slackUserId = payload.user?.id;
  const botToken = decryptKey(
    matchedUser.notificationSettings.slack.botToken
  );

  // Fetch selections from state.values
  const stateValues = payload.state?.values;
  const destination =
    getStateValue(stateValues, "slack_alarm_destination_select") || "vps_agent";
  const agentIdRaw =
    getStateValue(stateValues, "slack_alarm_agent_select") || "all";
  const metric = getStateValue(stateValues, "slack_alarm_metric_select");
  const comparator = getStateValue(
    stateValues,
    "slack_alarm_comparator_select"
  );
  const thresholdStr = getStateValue(
    stateValues,
    "slack_alarm_threshold_input"
  );
  const severity = getStateValue(
    stateValues,
    "slack_alarm_severity_select"
  );
  const customName = getStateValue(stateValues, "slack_alarm_name_input");
  const windowMinutesStr =
    getStateValue(stateValues, "slack_alarm_window_input") || "15";
  const cooldownMinutesStr =
    getStateValue(stateValues, "slack_alarm_cooldown_input") || "30";

  const source =
    getStateValue(stateValues, "slack_alarm_source_select") || "all";
  const service =
    getStateValue(stateValues, "slack_alarm_service_input") || "";
  const level =
    getStateValue(stateValues, "slack_alarm_level_select") || "error";
  const messagePattern =
    getStateValue(stateValues, "slack_alarm_pattern_input") || "";

  const name = customName?.trim() || `Slack Alarm: ${metric}`;
  const windowMinutes = Math.max(1, parseInt(windowMinutesStr, 10) || 15);
  const cooldownMinutes = Math.max(
    1,
    parseInt(cooldownMinutesStr, 10) || 30
  );

  const threshold = Number(thresholdStr);

  // Auto link slack user if they are not mapped yet
  const isMapped =
    matchedUser.notificationSettings.slack.slackUserMappings?.some(
      (m: any) => m.slackUserId === slackUserId
    );
  if (!isMapped) {
    if (!matchedUser.notificationSettings.slack.slackUserMappings) {
      matchedUser.notificationSettings.slack.slackUserMappings = [];
    }
    matchedUser.notificationSettings.slack.slackUserMappings.push({
      slackUserId,
      linkedAt: new Date(),
    });
    matchedUser.markModified("notificationSettings");
    await matchedUser.save();
    logger.info(
      `[Slack-Bot] Auto-linked User ${matchedUser.email} during interactive form submit`
    );
  }

  await executeAlarmCreation({
    userId: matchedUser._id.toString(),
    parsed: {
      name,
      destination: destination as any,
      type: metric === "log_volume" ? "log_volume" : "metric_threshold",
      metric: metric === "log_volume" ? undefined : (metric as any),
      comparator: comparator as any,
      threshold,
      severity: severity as any,
      agentId: agentIdRaw,
      windowMinutes,
      cooldownMinutes,
      source: source as any,
      service,
      level: level as any,
      messagePattern,
    },
    botToken,
    channelId,
    threadTs,
  });
}
