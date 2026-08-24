import mongoose, { Document, Schema } from "mongoose";
import {
  AI_BILLING_CURRENCIES,
  AI_CLOUD_PROVIDERS,
  AI_ENVIRONMENTS,
  AI_PII_POLICIES,
  AI_REQUIRED_EVENT_FIELDS,
  AI_SELF_HOSTED_TARGETS,
  AI_SOURCE_TYPES,
  AI_VENDOR_PROVIDERS,
  type AiBillingCurrency,
  type AiCloudProvider,
  type AiEnvironment,
  type AiPiiPolicy,
  type AiRequiredEventField,
  type AiSelfHostedTarget,
  type AiSourceType,
  type AiVendorProvider,
} from "../constants/ai-onboarding-options";

export interface IAiOnboardingProfile extends Document {
  userId: string;
  tenantId?: string;
  sourceTypes: AiSourceType[];
  vendorProviders: AiVendorProvider[];
  cloudProviders: AiCloudProvider[];
  selfHostedTargets: AiSelfHostedTarget[];
  orgName: string;
  tenantSlug: string;
  timezone: string;
  billingCurrency: AiBillingCurrency;
  workspaces: string[];
  environments: AiEnvironment[];
  allowedModels: Record<string, string[]>;
  monthlyBudgetUsd?: number;
  dailyBudgetUsd?: number;
  latencySloMs?: number;
  errorRateSloPct?: number;
  alertChannels: string[];
  piiPolicy?: AiPiiPolicy;
  retentionDays?: number;
  requiredEventFields: AiRequiredEventField[];
  createdAt: Date;
  updatedAt: Date;
}

const aiOnboardingProfileSchema = new Schema<IAiOnboardingProfile>(
  {
    userId: { type: String, required: true, unique: true },
    tenantId: { type: String, default: null },
    sourceTypes: {
      type: [String],
      enum: [...AI_SOURCE_TYPES],
      default: ["instrumented_app"],
    },
    vendorProviders: {
      type: [String],
      enum: [...AI_VENDOR_PROVIDERS],
      default: [],
    },
    cloudProviders: {
      type: [String],
      enum: [...AI_CLOUD_PROVIDERS],
      default: [],
    },
    selfHostedTargets: {
      type: [String],
      enum: [...AI_SELF_HOSTED_TARGETS],
      default: [],
    },
    orgName: { type: String, default: "" },
    tenantSlug: { type: String, default: "" },
    timezone: { type: String, default: "UTC" },
    billingCurrency: {
      type: String,
      enum: [...AI_BILLING_CURRENCIES],
      default: "USD",
    },
    workspaces: { type: [String], default: [] },
    environments: {
      type: [String],
      enum: [...AI_ENVIRONMENTS],
      default: ["prod"],
    },
    allowedModels: { type: Schema.Types.Mixed, default: {} },
    monthlyBudgetUsd: { type: Number, default: null },
    dailyBudgetUsd: { type: Number, default: null },
    latencySloMs: { type: Number, default: null },
    errorRateSloPct: { type: Number, default: null },
    alertChannels: { type: [String], default: [] },
    piiPolicy: { type: String, enum: [...AI_PII_POLICIES], default: "redact" },
    retentionDays: { type: Number, default: null },
    requiredEventFields: {
      type: [String],
      enum: [...AI_REQUIRED_EVENT_FIELDS],
      default: [...AI_REQUIRED_EVENT_FIELDS],
    },
  },
  { timestamps: true },
);

export const AiOnboardingProfile = mongoose.model<IAiOnboardingProfile>(
  "AiOnboardingProfile",
  aiOnboardingProfileSchema,
);
