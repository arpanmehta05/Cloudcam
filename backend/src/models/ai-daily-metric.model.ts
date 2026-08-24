// ─── AI Observability: Daily Aggregated Metrics Model ───
import mongoose, { Schema, Document } from "mongoose";

import type { AiProvider } from "./ai-request-log.model";

export interface IAiDailyMetric extends Document {
  userId: string;
  tenantId?: string;
  workspaceId?: string;
  environment?: string;
  date: string; // YYYY-MM-DD for easy grouping and querying
  provider: AiProvider;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  totalCost: number;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const aiDailyMetricSchema = new Schema<IAiDailyMetric>(
  {
    userId: { type: String, required: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    environment: { type: String, default: "prod" },
    date: { type: String, required: true }, // "2026-04-27"
    provider: {
      type: String,
      required: true,
    },
    requests: { type: Number, required: true, default: 0 },
    promptTokens: { type: Number, required: true, default: 0 },
    completionTokens: { type: Number, required: true, default: 0 },
    totalTokens: { type: Number, required: true, default: 0 },
    avgLatencyMs: { type: Number, required: true, default: 0 },
    totalCost: { type: Number, required: true, default: 0 },
    errorCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// ─── Indexes ───
// User daily dashboard: one row per provider per day
aiDailyMetricSchema.index({ userId: 1, date: -1 });
// Tenant/workspace dashboard path
aiDailyMetricSchema.index({
  tenantId: 1,
  workspaceId: 1,
  environment: 1,
  date: -1,
});
// Provider-level analytics across all users
aiDailyMetricSchema.index({ provider: 1, date: -1 });
// Prevent duplicate rows within an observability scope.
aiDailyMetricSchema.index(
  {
    userId: 1,
    tenantId: 1,
    workspaceId: 1,
    environment: 1,
    date: 1,
    provider: 1,
  },
  { unique: true },
);
aiDailyMetricSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export const AiDailyMetric = mongoose.model<IAiDailyMetric>(
  "AiDailyMetric",
  aiDailyMetricSchema,
);
