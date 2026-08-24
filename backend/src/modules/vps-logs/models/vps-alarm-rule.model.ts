import mongoose, { Document, Schema } from "mongoose";
import { VpsLogLevel, VpsLogSource } from "./vps-log-entry.model";

export type VpsAlarmRuleType = "metric_threshold" | "log_volume";
export type VpsAlarmMetric = "cpuPercent" | "ramPercent" | "diskUsedPercent";
export type VpsAlarmComparator = "gte" | "gt" | "lte" | "lt";
export type VpsAlarmSeverity = "critical" | "warning" | "info";

export interface IVpsAlarmRule extends Document {
  userId: string;
  name: string;
  type: VpsAlarmRuleType;
  enabled: boolean;
  agentId?: string;
  source?: VpsLogSource | "all";
  service?: string;
  level?: VpsLogLevel | "all";
  metric?: VpsAlarmMetric;
  comparator: VpsAlarmComparator;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  severity: VpsAlarmSeverity;
  messagePattern?: string;
  lastTriggeredAt?: Date;
  lastValue?: number;
  lastMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vpsAlarmRuleSchema = new Schema<IVpsAlarmRule>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["metric_threshold", "log_volume"],
      required: true,
    },
    enabled: { type: Boolean, default: true, index: true },
    agentId: { type: String, default: "all", index: true },
    source: {
      type: String,
      enum: ["all", "docker", "pm2", "system", "nginx", "apache"],
      default: "all",
    },
    service: { type: String, default: "" },
    level: {
      type: String,
      enum: ["all", "error", "warn", "info", "debug"],
      default: "error",
    },
    metric: {
      type: String,
      enum: ["cpuPercent", "ramPercent", "diskUsedPercent"],
    },
    comparator: {
      type: String,
      enum: ["gte", "gt", "lte", "lt"],
      default: "gte",
    },
    threshold: { type: Number, required: true },
    windowMinutes: { type: Number, default: 15 },
    cooldownMinutes: { type: Number, default: 30 },
    severity: {
      type: String,
      enum: ["critical", "warning", "info"],
      default: "warning",
    },
    messagePattern: { type: String, default: "" },
    lastTriggeredAt: { type: Date },
    lastValue: { type: Number },
    lastMessage: { type: String },
  },
  { timestamps: true },
);

vpsAlarmRuleSchema.index({ userId: 1, enabled: 1, type: 1 });
vpsAlarmRuleSchema.index({ userId: 1, agentId: 1, enabled: 1 });

export const VpsAlarmRule = mongoose.model<IVpsAlarmRule>(
  "VpsAlarmRule",
  vpsAlarmRuleSchema,
);
