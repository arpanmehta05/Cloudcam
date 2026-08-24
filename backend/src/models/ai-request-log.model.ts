// ─── AI Observability: Request Log Model ───
import mongoose, { Schema, Document } from "mongoose";

// Supported AI providers
export type AiProvider = string;

// Request outcome statuses
export type AiRequestStatus = "success" | "error" | "rate_limited" | "timeout";
export type AiPricingSource = "provided" | "custom" | "default" | "unpriced";

export interface AiRequestFeedbackSummary {
  count: number;
  avgScore?: number | null;
  latestSentiment?: "positive" | "neutral" | "negative" | null;
  tags?: string[];
  lastFeedbackAt?: Date | null;
}

export interface IAiRequestLog extends Document {
  userId: string;
  tenantId?: string;
  workspaceId?: string;
  environment?: string;
  serviceName?: string;
  endpoint?: string;
  provider: AiProvider;
  modelName: string;
  requestId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost: number;
  pricingSource?: AiPricingSource;
  pricingEstimated?: boolean;
  unpriced?: boolean;
  status: AiRequestStatus;
  errorMessage?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  sessionId?: string | null;
  endUserId?: string | null;
  completionStartTime?: Date | null;
  modelParameters?: Record<string, unknown> | null;
  operationName?: string;
  inputPreview?: string;
  outputPreview?: string;
  promptHash?: string;
  promptTemplateId?: string;
  promptVersionId?: string;
  promptName?: string;
  promptSlug?: string;
  promptVersion?: string;
  promptLabel?: string;
  promptEnvironment?: string;
  promptState?: "draft" | "production" | "archived";
  promptContentHash?: string;
  feedbackSummary?: AiRequestFeedbackSummary;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const aiRequestLogSchema = new Schema<IAiRequestLog>(
  {
    userId: { type: String, required: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    environment: { type: String, default: "prod" },
    serviceName: { type: String, default: null },
    endpoint: { type: String, default: null },
    provider: {
      type: String,
      required: true,
    },
    modelName: { type: String, required: true },
    requestId: { type: String, required: true },
    promptTokens: { type: Number, required: true, default: 0 },
    completionTokens: { type: Number, required: true, default: 0 },
    totalTokens: { type: Number, required: true, default: 0 },
    latencyMs: { type: Number, required: true, default: 0 },
    cost: { type: Number, required: true, default: 0 },
    pricingSource: {
      type: String,
      enum: ["provided", "custom", "default", "unpriced", null],
      default: null,
    },
    pricingEstimated: { type: Boolean, default: null },
    unpriced: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["success", "error", "rate_limited", "timeout"],
      required: true,
      default: "success",
    },
    errorMessage: { type: String, default: null },
    traceId: { type: String, default: null },
    spanId: { type: String, default: null },
    parentSpanId: { type: String, default: null },
    sessionId: { type: String, default: null, index: true },
    endUserId: { type: String, default: null },
    completionStartTime: { type: Date, default: null },
    modelParameters: { type: Schema.Types.Mixed, default: null },
    operationName: { type: String, default: null },
    inputPreview: { type: String, default: null },
    outputPreview: { type: String, default: null },
    promptHash: { type: String, default: null },
    promptTemplateId: { type: String, default: null },
    promptVersionId: { type: String, default: null },
    promptName: { type: String, default: null },
    promptSlug: { type: String, default: null },
    promptVersion: { type: String, default: null },
    promptLabel: { type: String, default: null },
    promptEnvironment: { type: String, default: null },
    promptState: {
      type: String,
      enum: ["draft", "production", "archived", null],
      default: null,
    },
    promptContentHash: { type: String, default: null },
    feedbackSummary: { type: Schema.Types.Mixed, default: null },
    tags: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// ─── Indexes ───
// Primary query: user's request history sorted by time
aiRequestLogSchema.index({ userId: 1, createdAt: -1 });
// Tenant/workspace timeline queries
aiRequestLogSchema.index({ tenantId: 1, workspaceId: 1, createdAt: -1 });
// Filter by provider over time
aiRequestLogSchema.index({ provider: 1, createdAt: -1 });
// Filter by model over time
aiRequestLogSchema.index({ modelName: 1, createdAt: -1 });
// Unique request tracing
aiRequestLogSchema.index({ requestId: 1 }, { unique: true });
// Trace-linked request exploration
aiRequestLogSchema.index({ userId: 1, traceId: 1, createdAt: 1 });
aiRequestLogSchema.index({ traceId: 1, spanId: 1 });
aiRequestLogSchema.index({
  userId: 1,
  serviceName: 1,
  endpoint: 1,
  createdAt: -1,
});
aiRequestLogSchema.index({ userId: 1, promptName: 1, createdAt: -1 });
aiRequestLogSchema.index({ userId: 1, promptSlug: 1, createdAt: -1 });
aiRequestLogSchema.index({ userId: 1, promptVersionId: 1, createdAt: -1 });
aiRequestLogSchema.index({ userId: 1, promptLabel: 1, createdAt: -1 });
aiRequestLogSchema.index({ userId: 1, "feedbackSummary.avgScore": 1, createdAt: -1 });
aiRequestLogSchema.index({ userId: 1, unpriced: 1, provider: 1, modelName: 1, createdAt: -1 });
// Operational AI request logs are retained for 30 days.
aiRequestLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export const AiRequestLog = mongoose.model<IAiRequestLog>(
  "AiRequestLog",
  aiRequestLogSchema,
);
