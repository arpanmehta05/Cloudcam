// ─── AI Observability: Budget Rules Model ───
import mongoose, { Schema, Document } from "mongoose";

export interface IAiBudgetRule extends Document {
  userId: string;
  monthlyLimit: number;
  dailyLimit?: number;
  alertThresholdPercent: number; // e.g. 80 means alert at 80% of limit
  autoPause: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const aiBudgetRuleSchema = new Schema<IAiBudgetRule>(
  {
    userId: { type: String, required: true, unique: true },
    monthlyLimit: { type: Number, required: true },
    dailyLimit: { type: Number, default: null },
    alertThresholdPercent: { type: Number, required: true, default: 80 },
    autoPause: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ─── Indexes ───
// One budget rule per user — the unique constraint on userId handles this
// Quick lookup for active budget rules (cron jobs / enforcement)
aiBudgetRuleSchema.index({ enabled: 1 });

export const AiBudgetRule = mongoose.model<IAiBudgetRule>(
  "AiBudgetRule",
  aiBudgetRuleSchema,
);
