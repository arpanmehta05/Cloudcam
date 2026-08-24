// ─── Optimization Cache Model — Stores scored insights with TTL ───
import mongoose, { Schema, Document } from "mongoose";

export type OptimizationType =
  | "rightsizing"
  | "spot_migration"
  | "savings_plan"
  | "reserved_instance"
  | "orphaned_ebs"
  | "orphaned_rds"
  | "orphaned_s3";
export type PricingModel = "on_demand" | "reserved" | "spot" | "savings_plan";

export interface IOptimizationInsight extends Document {
  userId: string;
  resourceId: string;
  resourceName: string;
  region: string;
  type: OptimizationType;
  currentPricingModel: PricingModel;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  score: number;
  confidenceFactor: number;
  riskWeight: number;
  usageVarianceCoefficient: number;
  interruptionRiskScore?: number;
  azDiversity?: number;
  instanceFamilyFlexibility?: number;
  actionId: string;
  stale: boolean;
  lastValidatedAt: Date;
  generatedAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

const optimizationInsightSchema = new Schema<IOptimizationInsight>(
  {
    userId: { type: String, required: true, index: true },
    resourceId: { type: String, required: true },
    resourceName: { type: String, default: "" },
    region: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "rightsizing",
        "spot_migration",
        "savings_plan",
        "reserved_instance",
        "orphaned_ebs",
        "orphaned_rds",
        "orphaned_s3",
      ],
      required: true,
    },
    currentPricingModel: {
      type: String,
      enum: ["on_demand", "reserved", "spot", "savings_plan"],
      default: "on_demand",
    },
    currentMonthlyCost: { type: Number, default: 0 },
    estimatedMonthlySavings: { type: Number, required: true },
    score: { type: Number, required: true },
    confidenceFactor: { type: Number, required: true },
    riskWeight: { type: Number, required: true },
    usageVarianceCoefficient: { type: Number, default: 0 },
    interruptionRiskScore: Number,
    azDiversity: Number,
    instanceFamilyFlexibility: Number,
    actionId: { type: String, required: true },
    stale: { type: Boolean, default: false },
    lastValidatedAt: { type: Date, default: Date.now },
    generatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// Compound index for deduplication guard: one active insight per resource+type per user
optimizationInsightSchema.index(
  { userId: 1, resourceId: 1, type: 1 },
  { unique: true },
);

// TTL index — MongoDB will auto-purge expired documents
optimizationInsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OptimizationInsight = mongoose.model<IOptimizationInsight>(
  "OptimizationInsight",
  optimizationInsightSchema,
);

// ─── Pricing Model Snapshot — caches the cost breakdown ───
export interface IPricingModelSnapshot extends Document {
  userId: string;
  breakdown: {
    onDemand: number;
    reserved: number;
    spot: number;
    savingsPlan: number;
    other: number;
    total: number;
  };
  percentages: {
    onDemand: number;
    reserved: number;
    spot: number;
    savingsPlan: number;
  };
  generatedAt: Date;
  expiresAt: Date;
}

const pricingModelSnapshotSchema = new Schema<IPricingModelSnapshot>(
  {
    userId: { type: String, required: true, unique: true },
    breakdown: {
      onDemand: { type: Number, default: 0 },
      reserved: { type: Number, default: 0 },
      spot: { type: Number, default: 0 },
      savingsPlan: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    percentages: {
      onDemand: { type: Number, default: 0 },
      reserved: { type: Number, default: 0 },
      spot: { type: Number, default: 0 },
      savingsPlan: { type: Number, default: 0 },
    },
    generatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

pricingModelSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PricingModelSnapshot = mongoose.model<IPricingModelSnapshot>(
  "PricingModelSnapshot",
  pricingModelSnapshotSchema,
);
