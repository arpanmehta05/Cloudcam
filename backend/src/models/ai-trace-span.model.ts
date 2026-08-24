import mongoose, { Schema, Document } from "mongoose";
import { AiPricingSource, AiProvider, AiRequestStatus } from "./ai-request-log.model";
import type { AiFeedbackSummary, AiObservationLevel } from "./ai-trace.model";

export type AiTraceSpanKind =
  | "chain"
  | "tool"
  | "llm"
  | "embedding"
  | "reranker"
  | "custom"
  | "event"
  | "retrieval"
  | "agent"
  | "evaluator"
  | "guardrail";

export interface IAiTraceSpan extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  environment?: string | null;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  serviceName?: string | null;
  endpoint?: string | null;
  kind: AiTraceSpanKind;
  provider?: AiProvider;
  modelName?: string;
  status: AiRequestStatus;
  level: AiObservationLevel;
  statusMessage?: string | null;
  startedAt: Date;
  endedAt?: Date;
  completionStartTime?: Date | null;
  durationMs?: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  pricingSource?: AiPricingSource;
  pricingEstimated?: boolean;
  unpriced?: boolean;
  errorMessage?: string;
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
  feedbackSummary?: AiFeedbackSummary;
  modelParameters?: Record<string, unknown> | null;
  endUserId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const aiTraceSpanSchema = new Schema<IAiTraceSpan>(
  {
    userId: { type: String, required: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    environment: { type: String, default: null },
    traceId: { type: String, required: true },
    spanId: { type: String, required: true },
    parentSpanId: { type: String, default: null },
    name: { type: String, required: true },
    serviceName: { type: String, default: null },
    endpoint: { type: String, default: null },
    kind: {
      type: String,
      enum: [
        "chain",
        "tool",
        "llm",
        "embedding",
        "reranker",
        "custom",
        "event",
        "retrieval",
        "agent",
        "evaluator",
        "guardrail",
      ],
      required: true,
    },
    provider: { type: String, default: null },
    modelName: { type: String, default: null },
    status: {
      type: String,
      enum: ["success", "error", "rate_limited", "timeout"],
      required: true,
      default: "success",
    },
    level: {
      type: String,
      enum: ["DEBUG", "DEFAULT", "WARNING", "ERROR", null],
      default: "DEFAULT",
    },
    statusMessage: { type: String, default: null },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    completionStartTime: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    promptTokens: { type: Number, required: true, default: 0 },
    completionTokens: { type: Number, required: true, default: 0 },
    totalTokens: { type: Number, required: true, default: 0 },
    cost: { type: Number, required: true, default: 0 },
    pricingSource: {
      type: String,
      enum: ["provided", "custom", "default", "unpriced", null],
      default: null,
    },
    pricingEstimated: { type: Boolean, default: null },
    unpriced: { type: Boolean, default: false },
    errorMessage: { type: String, default: null },
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
    modelParameters: { type: Schema.Types.Mixed, default: null },
    endUserId: { type: String, default: null },
    sessionId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

aiTraceSpanSchema.index({ userId: 1, traceId: 1, startedAt: 1 });
aiTraceSpanSchema.index({ userId: 1, traceId: 1, spanId: 1 }, { unique: true });
aiTraceSpanSchema.index({
  userId: 1,
  provider: 1,
  modelName: 1,
  startedAt: -1,
});
aiTraceSpanSchema.index({ userId: 1, environment: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, serviceName: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, endpoint: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, sessionId: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, endUserId: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, kind: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, status: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, cost: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, durationMs: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, unpriced: 1, provider: 1, modelName: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, promptName: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, promptSlug: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, promptVersionId: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, promptLabel: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, promptEnvironment: 1, startedAt: -1 });
aiTraceSpanSchema.index({ userId: 1, "feedbackSummary.avgScore": 1, startedAt: -1 });
aiTraceSpanSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export const AiTraceSpan = mongoose.model<IAiTraceSpan>(
  "AiTraceSpan",
  aiTraceSpanSchema,
);
