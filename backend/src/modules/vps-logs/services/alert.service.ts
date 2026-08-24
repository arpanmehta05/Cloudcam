import { User } from "../../../models/user.model";
import { VpsAlertPolicy } from "../models/vps-alert-policy.model";
import { VpsLogAgent } from "../models/vps-log-agent.model";
import { VpsLogEntry } from "../models/vps-log-entry.model";
import {
  VpsAlarmRule,
  VpsAlarmComparator,
  VpsAlarmMetric,
  VpsAlarmRuleType,
  IVpsAlarmRule,
} from "../models/vps-alarm-rule.model";
import { randomBytes } from "crypto";
import { createVpsLogAgent } from "./agent.service";
import {
  sendVpsAlarmEmail,
  sendVpsAlarmSlack,
  StoredVpsLogEntry,
} from "./alert-notification.service";

export interface VpsAlarmEvaluationResult {
  ruleId: string;
  name: string;
  type: VpsAlarmRuleType;
  triggered: boolean;
  value?: number;
  threshold: number;
  emailSent: boolean;
  skippedReason?: string;
  error?: string;
}

const ERROR_ALERT_THRESHOLD = Math.max(
  1,
  parseInt(process.env.VPS_LOG_ERROR_ALERT_THRESHOLD || "25", 10)
);
const ERROR_ALERT_WINDOW_MINUTES = Math.max(
  1,
  parseInt(process.env.VPS_LOG_ERROR_ALERT_WINDOW_MINUTES || "15", 10)
);
const ERROR_ALERT_COOLDOWN_MINUTES = Math.max(
  1,
  parseInt(process.env.VPS_LOG_ERROR_ALERT_COOLDOWN_MINUTES || "60", 10)
);

function compareAlarmValue(
  value: number,
  comparator: VpsAlarmComparator,
  threshold: number
): boolean {
  if (comparator === "gt") return value > threshold;
  if (comparator === "lte") return value <= threshold;
  if (comparator === "lt") return value < threshold;
  return value >= threshold;
}

function parseHostMetricValue(
  entry: StoredVpsLogEntry,
  metric: VpsAlarmMetric
): number | null {
  if (entry.source !== "system" || entry.service !== "host-metrics")
    return null;
  try {
    const parsed = JSON.parse(entry.message);
    if (metric === "ramPercent") {
      const used = Number(parsed.ramUsedMb || 0);
      const total = Number(parsed.ramTotalMb || 0);
      return total > 0 ? (used / total) * 100 : null;
    }
    const value = Number(parsed[metric]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function evaluateVpsAlarmRules(
  agent: any,
  entries: StoredVpsLogEntry[]
): Promise<VpsAlarmEvaluationResult[]> {
  const results: VpsAlarmEvaluationResult[] = [];
  const rules = await VpsAlarmRule.find({
    userId: agent.userId,
    enabled: true,
    $or: [
      { agentId: "all" },
      { agentId: agent.agentId },
      { agentId: "" },
      { agentId: { $exists: false } },
    ],
  });
  if (!rules.length) return results;

  const user = await User.findById(agent.userId).lean();
  if (!user?.email) {
    return rules.map((rule) => ({
      ruleId: String(rule._id),
      name: rule.name,
      type: rule.type,
      triggered: false,
      threshold: rule.threshold,
      emailSent: false,
      skippedReason: "account_holder_email_not_found",
    }));
  }

  const now = new Date();

  for (const rule of rules) {
    const cooldownStart = new Date(
      now.getTime() - rule.cooldownMinutes * 60 * 1000
    );
    if (rule.lastTriggeredAt && rule.lastTriggeredAt >= cooldownStart) {
      results.push({
        ruleId: String(rule._id),
        name: rule.name,
        type: rule.type,
        triggered: false,
        threshold: rule.threshold,
        emailSent: false,
        skippedReason: "cooldown_active",
      });
      continue;
    }

    let value: number | null = null;
    let sample: StoredVpsLogEntry | undefined;

    if (rule.type === "metric_threshold" && rule.metric) {
      for (const entry of entries) {
        const metricValue = parseHostMetricValue(entry, rule.metric);
        if (metricValue === null) continue;
        value = value === null ? metricValue : Math.max(value, metricValue);
        sample = entry;
      }
    } else if (rule.type === "log_volume") {
      const windowStart = new Date(
        now.getTime() - rule.windowMinutes * 60 * 1000
      );
      const query: any = {
        userId: agent.userId,
        agentId: agent.agentId,
        timestamp: { $gte: windowStart },
      };
      if (rule.source && rule.source !== "all") query.source = rule.source;
      if (rule.service) query.service = rule.service;
      if (rule.level && rule.level !== "all") query.level = rule.level;
      if (rule.messagePattern)
        query.message = {
          $regex: escapeRegExp(rule.messagePattern),
          $options: "i",
        };

      value = await VpsLogEntry.countDocuments(query);
      sample = entries.find((entry) => {
        if (
          rule.source &&
          rule.source !== "all" &&
          entry.source !== rule.source
        )
          return false;
        if (rule.service && entry.service !== rule.service) return false;
        if (rule.level && rule.level !== "all" && entry.level !== rule.level)
          return false;
        if (
          rule.messagePattern &&
          !entry.message
            .toLowerCase()
            .includes(rule.messagePattern.toLowerCase())
        )
          return false;
        return true;
      });
    }

    if (
      value === null ||
      !compareAlarmValue(value, rule.comparator, rule.threshold)
    ) {
      results.push({
        ruleId: String(rule._id),
        name: rule.name,
        type: rule.type,
        triggered: false,
        value: value ?? undefined,
        threshold: rule.threshold,
        emailSent: false,
        skippedReason: "below_threshold",
      });
      continue;
    }

    try {
      await sendVpsAlarmEmail({
        userEmail: user.email,
        agent,
        rule,
        value,
        sample,
      });
      await sendVpsAlarmSlack({ user, agent, rule, value, sample });
      await VpsAlarmRule.updateOne(
        { _id: rule._id },
        {
          $set: {
            lastTriggeredAt: now,
            lastValue: value,
            lastMessage: sample?.message?.slice(0, 1000) || `${value}`,
          },
        }
      );
      results.push({
        ruleId: String(rule._id),
        name: rule.name,
        type: rule.type,
        triggered: true,
        value,
        threshold: rule.threshold,
        emailSent: true,
      });
    } catch (error: any) {
      results.push({
        ruleId: String(rule._id),
        name: rule.name,
        type: rule.type,
        triggered: true,
        value,
        threshold: rule.threshold,
        emailSent: false,
        skippedReason: "email_send_failed",
        error: error?.message || "Unknown email error",
      });
    }
  }

  return results;
}

export async function runVpsLogAlertMailTest(sourceAgentId: string) {
  const sourceAgent = await VpsLogAgent.findOne({
    agentId: sourceAgentId,
  }).lean();
  if (!sourceAgent) {
    throw new Error("Source agent not found");
  }

  const user = await User.findById(sourceAgent.userId).lean();
  if (!user?.email) {
    throw new Error("Source agent account holder email not found");
  }

  const testAgent = await createVpsLogAgent(sourceAgent.userId, {
    name: "Mail Alert Test Agent",
    vpcId: sourceAgent.vpcId || "test",
    environment: "test",
  });

  const token = randomBytes(6).toString("hex");
  const errorLine = `ERROR VPS_MAIL_ALERT_TEST_${token} simulated repeated database connection failure`;
  const logsBase64 = Buffer.from(
    Array.from({ length: ERROR_ALERT_THRESHOLD }, () => errorLine).join("\n"),
    "utf8"
  ).toString("base64");

  // Dynamic import to avoid circular dependency
  const { ingestVpsLogs } = await import("./ingest.service");

  const result = await ingestVpsLogs(
    {
      agentId: testAgent.agent.agentId,
      source: "pm2",
      service: "mail-alert-test",
      logsBase64,
      timestamp: new Date().toISOString(),
    },
    testAgent.agent.agentId,
    testAgent.ingestKey
  );

  return {
    accountHolderEmail: user.email,
    sourceAgentId,
    testAgentId: testAgent.agent.agentId,
    sentRepeatedErrors: ERROR_ALERT_THRESHOLD,
    signatureToken: token,
    ...result,
  };
}

export async function updateVpsLogAlertPolicy(
  userId: string,
  input: {
    errorSignatureThreshold?: number;
    windowMinutes?: number;
    cooldownMinutes?: number;
  }
) {
  const update: Record<string, any> = {};
  if (input.errorSignatureThreshold !== undefined) {
    update.errorSignatureThreshold = Math.max(
      1,
      parseInt(String(input.errorSignatureThreshold), 10)
    );
  }
  if (input.windowMinutes !== undefined) {
    update.windowMinutes = Math.max(
      1,
      parseInt(String(input.windowMinutes), 10)
    );
  }
  if (input.cooldownMinutes !== undefined) {
    update.cooldownMinutes = Math.max(
      1,
      parseInt(String(input.cooldownMinutes), 10)
    );
  }

  const policy = await VpsAlertPolicy.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  ).lean();

  return {
    success: true,
    alertPolicy: {
      errorSignatureThreshold: policy.errorSignatureThreshold,
      windowMinutes: policy.windowMinutes,
      cooldownMinutes: policy.cooldownMinutes,
    },
  };
}
