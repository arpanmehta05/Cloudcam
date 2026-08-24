import mongoose, { Document, Schema } from "mongoose";
import type { IPlanLimits } from "./plan.model";

export type SubscriptionStatus = "active" | "trialing" | "canceled";

export interface ISubscriptionOverrides {
  features: Map<string, boolean>; // per-tenant feature override on top of plan
  limits: IPlanLimits; // per-tenant limit override (null field = inherit plan)
}

export interface ISubscription extends Document {
  tenantId: string; // one subscription per tenant
  planKey: string; // references Plan.key
  overrides: ISubscriptionOverrides;
  status: SubscriptionStatus;
  startedAt: Date;
  renewsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    planKey: { type: String, required: true, lowercase: true, trim: true },
    overrides: {
      features: { type: Map, of: Boolean, default: {} },
      limits: {
        workspaces: { type: Number, default: null },
        cloudConnections: { type: Number, default: null },
        retentionDays: { type: Number, default: null },
        seats: { type: Number, default: null },
      },
    },
    status: {
      type: String,
      enum: ["active", "trialing", "canceled"],
      default: "active",
    },
    startedAt: { type: Date, default: Date.now },
    renewsAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema,
);
