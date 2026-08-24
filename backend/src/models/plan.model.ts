import mongoose, { Document, Schema } from "mongoose";

export type BillingPeriod = "monthly" | "yearly" | "custom";

export interface IPlanLimits {
  workspaces?: number | null; // null = unlimited
  cloudConnections?: number | null;
  retentionDays?: number | null;
  seats?: number | null;
}

export interface IPlan extends Document {
  key: string; // slug, e.g. "pro" — used in URLs and code
  name: string;
  description?: string | null;
  price: number; // per billing period, in currency units
  currency: string;
  billingPeriod: BillingPeriod;
  features: Map<string, boolean>; // featureKey -> enabled
  limits: IPlanLimits;
  isPublic: boolean; // false = hidden / custom deal
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    price: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    billingPeriod: {
      type: String,
      enum: ["monthly", "yearly", "custom"],
      default: "monthly",
    },
    // Dynamic feature map keeps the panel adaptable: new registry features
    // simply become new keys here with no schema change.
    features: { type: Map, of: Boolean, default: {} },
    limits: {
      workspaces: { type: Number, default: null },
      cloudConnections: { type: Number, default: null },
      retentionDays: { type: Number, default: null },
      seats: { type: Number, default: null },
    },
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Plan = mongoose.model<IPlan>("Plan", planSchema);
