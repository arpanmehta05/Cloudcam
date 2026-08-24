// ─── AI Observability: Alerts Model ───
import mongoose, { Schema, Document } from "mongoose";

// Alert trigger types
export type AiAlertType =
  | "cost_spike"
  | "token_spike"
  | "error_spike"
  | "latency_spike"
  | "budget_limit"
  | "bill_shock"
  | "new_model"
  | "error_cost";

// Severity levels
export type AiAlertSeverity = "low" | "medium" | "high" | "critical";

// Lifecycle status
export type AiAlertStatus = "open" | "acknowledged" | "resolved";

export interface IAiAlert extends Document {
  userId: string;
  type: AiAlertType;
  severity: AiAlertSeverity;
  title: string;
  message: string;
  status: AiAlertStatus;
  metadata?: Record<string, any>;
  createdAt: Date;
  resolvedAt?: Date;
  updatedAt: Date;
}

const aiAlertSchema = new Schema<IAiAlert>(
  {
    userId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "cost_spike",
        "token_spike",
        "error_spike",
        "latency_spike",
        "budget_limit",
        "bill_shock",
        "new_model",
        "error_cost",
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      default: "medium",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved"],
      default: "open",
    },
    metadata: { type: Schema.Types.Mixed },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ─── Indexes ───
// User's active alerts (status filter)
aiAlertSchema.index({ userId: 1, status: 1 });
// Global timeline view
aiAlertSchema.index({ createdAt: -1 });
// Archive retention: resolved alerts are auto-deleted 3 months (90 days) after
// resolution. Open/acknowledged alerts have resolvedAt=null and never expire —
// MongoDB's TTL monitor skips documents whose indexed field is not a date.
aiAlertSchema.index(
  { resolvedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

export const AiAlert = mongoose.model<IAiAlert>("AiAlert", aiAlertSchema);
