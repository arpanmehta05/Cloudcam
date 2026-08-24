import {
  VpsAlarmRule,
  VpsAlarmRuleType,
  VpsAlarmMetric,
  VpsAlarmComparator,
  VpsAlarmSeverity,
} from "../models/vps-alarm-rule.model";
import { VpsLogLevel, VpsLogSource } from "../models/vps-log-entry.model";

export interface CreateVpsAlarmRuleInput {
  name: string;
  type: VpsAlarmRuleType;
  agentId?: string;
  source?: VpsLogSource | "all";
  service?: string;
  level?: VpsLogLevel | "all";
  metric?: VpsAlarmMetric;
  comparator?: VpsAlarmComparator;
  threshold: number;
  windowMinutes?: number;
  cooldownMinutes?: number;
  severity?: VpsAlarmSeverity;
  messagePattern?: string;
}

function formatAlarmRule(rule: any) {
  return {
    id: String(rule._id),
    name: rule.name,
    type: rule.type,
    enabled: rule.enabled,
    agentId: rule.agentId || "all",
    source: rule.source || "all",
    service: rule.service || "",
    level: rule.level || "error",
    metric: rule.metric || "",
    comparator: rule.comparator || "gte",
    threshold: rule.threshold,
    windowMinutes: rule.windowMinutes,
    cooldownMinutes: rule.cooldownMinutes,
    severity: rule.severity,
    messagePattern: rule.messagePattern || "",
    lastTriggeredAt: rule.lastTriggeredAt || null,
    lastValue: typeof rule.lastValue === "number" ? rule.lastValue : null,
    lastMessage: rule.lastMessage || "",
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function normalizeAlarmRuleInput(
  input: CreateVpsAlarmRuleInput,
  partial = false
) {
  const update: Record<string, any> = {};

  if (!partial || input.name !== undefined) {
    const name = String(input.name || "").trim();
    if (!name) throw new Error("Alarm name is required");
    update.name = name.slice(0, 120);
  }

  if (!partial || input.type !== undefined) {
    if (input.type !== "metric_threshold" && input.type !== "log_volume") {
      throw new Error("Alarm type must be metric_threshold or log_volume");
    }
    update.type = input.type;
  }

  const type = update.type || input.type;
  if (!partial || input.threshold !== undefined) {
    const threshold = Number(input.threshold);
    if (!Number.isFinite(threshold) || threshold < 0)
      throw new Error("Threshold must be a positive number");
    update.threshold = threshold;
  }

  if (!partial || input.metric !== undefined) {
    if (type === "metric_threshold") {
      if (
        input.metric !== "cpuPercent" &&
        input.metric !== "ramPercent" &&
        input.metric !== "diskUsedPercent"
      ) {
        throw new Error(
          "Metric alarm requires cpuPercent, ramPercent, or diskUsedPercent"
        );
      }
      update.metric = input.metric;
      update.source = "system";
      update.service = "host-metrics";
    } else if (input.metric) {
      update.metric = input.metric;
    }
  }

  if (input.agentId !== undefined || !partial)
    update.agentId = input.agentId || "all";
  if (input.source !== undefined || (!partial && type !== "metric_threshold"))
    update.source = input.source || "all";
  if (input.service !== undefined || (!partial && type !== "metric_threshold"))
    update.service = input.service || "";
  if (input.level !== undefined || (!partial && type === "log_volume"))
    update.level = input.level || "error";
  if (input.comparator !== undefined || !partial)
    update.comparator = input.comparator || "gte";
  if (input.windowMinutes !== undefined || !partial)
    update.windowMinutes = Math.max(
      1,
      Math.min(Number(input.windowMinutes || 15), 24 * 60)
    );
  if (input.cooldownMinutes !== undefined || !partial)
    update.cooldownMinutes = Math.max(
      1,
      Math.min(Number(input.cooldownMinutes || 30), 24 * 60)
    );
  if (input.severity !== undefined || !partial)
    update.severity = input.severity || "warning";
  if (input.messagePattern !== undefined || !partial)
    update.messagePattern = String(input.messagePattern || "")
      .trim()
      .slice(0, 240);

  return update;
}

export async function listVpsAlarmRules(userId: string) {
  const rules = await VpsAlarmRule.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  return rules.map(formatAlarmRule);
}

export async function createVpsAlarmRule(
  userId: string,
  input: CreateVpsAlarmRuleInput
) {
  const normalized = normalizeAlarmRuleInput(input);
  const rule = await VpsAlarmRule.create({
    userId,
    enabled: true,
    ...normalized,
  });
  return formatAlarmRule(rule);
}

export async function updateVpsAlarmRule(
  userId: string,
  ruleId: string,
  input: Partial<CreateVpsAlarmRuleInput> & { enabled?: boolean }
) {
  const normalized = normalizeAlarmRuleInput(
    input as CreateVpsAlarmRuleInput,
    true
  );
  if (input.enabled !== undefined) normalized.enabled = !!input.enabled;

  const rule = await VpsAlarmRule.findOneAndUpdate(
    { _id: ruleId, userId },
    { $set: normalized },
    { returnDocument: "after" }
  ).lean();
  if (!rule) throw new Error("Alarm rule not found");
  return formatAlarmRule(rule);
}

export async function deleteVpsAlarmRule(userId: string, ruleId: string) {
  const result = await VpsAlarmRule.deleteOne({ _id: ruleId, userId });
  return { deleted: result.deletedCount === 1 };
}
