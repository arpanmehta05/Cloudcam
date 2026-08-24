import mongoose, { Schema, Document } from "mongoose";

export type AiTraceStatus = "success" | "error" | "partial";
export type AiObservationLevel = "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";

export interface AiFeedbackSummary {
  count: number;
  avgScore?: number | null;
  latestSentiment?: "positive" | "neutral" | "negative" | null;
  tags?: string[];
  lastFeedbackAt?: Date | null;
}

export interface IAiTrace extends Document {
  userId: string;
  tenantId?: string;
  workspaceId?: string;
  environment: string;
  traceId: string;
  name?: string;
  serviceName?: string;
  endpoint?: string;
  sessionId?: string | null;
  endUserId?: string | null;
  release?: string | null;
  level: AiObservationLevel;
  public: boolean;
  status: AiTraceStatus;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  totalCost: number;
  totalTokens: number;
  errorCount: number;
  spanCount: number;
  unpricedSpanCount?: number;
  pricingSources?: string[];
  promptTemplateId?: string;
  promptVersionId?: string;
  promptName?: string;
  promptSlug?: string;
  promptVersion?: string;
  promptLabel?: string;
  promptEnvironment?: string;
  promptState?: "draft" | "production" | "archived";
  promptContentHash?: string;
  promptHash?: string;
  feedbackSummary?: AiFeedbackSummary;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const aiTraceSchema = new Schema<IAiTrace>(
  {
    userId: { type: String, required: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    environment: { type: String, required: true, default: "prod" },
    traceId: { type: String, required: true },
    name: { type: String, default: null },
    serviceName: { type: String, default: null },
    endpoint: { type: String, default: null },
    sessionId: { type: String, default: null, index: true },
    endUserId: { type: String, default: null, index: true },
    release: { type: String, default: null },
    level: {
      type: String,
      enum: ["DEBUG", "DEFAULT", "WARNING", "ERROR", null],
      default: "DEFAULT",
    },
    public: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["success", "error", "partial"],
      required: true,
      default: "success",
    },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    totalCost: { type: Number, required: true, default: 0 },
    totalTokens: { type: Number, required: true, default: 0 },
    errorCount: { type: Number, required: true, default: 0 },
    spanCount: { type: Number, required: true, default: 0 },
    unpricedSpanCount: { type: Number, required: true, default: 0 },
    pricingSources: { type: [String], default: [] },
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
    promptHash: { type: String, default: null },
    feedbackSummary: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

aiTraceSchema.index({ userId: 1, traceId: 1 }, { unique: true });
aiTraceSchema.index({ userId: 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, serviceName: 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, promptName: 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, promptSlug: 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, promptVersionId: 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, promptLabel: 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, "feedbackSummary.avgScore": 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, "feedbackSummary.tags": 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, sessionId: 1, startedAt: -1 });
aiTraceSchema.index({ userId: 1, endUserId: 1, startedAt: -1 });
aiTraceSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export const AiTrace = mongoose.model<IAiTrace>("AiTrace", aiTraceSchema);
