import mongoose, { Document, Schema } from "mongoose";

export type FeedbackTargetType =
  | "trace"
  | "span"
  | "request"
  | "session"
  | "end_user"
  | "dataset_item"
  | "dataset_run_item"
  | "experiment_result";
export type FeedbackSentiment = "positive" | "neutral" | "negative";
export type FeedbackDataType = "numeric" | "categorical" | "boolean" | "text";
export type FeedbackSource = "human" | "judge" | "api" | "system" | "annotation" | "user_feedback" | "evaluator";

export interface IHumanFeedback extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  targetType: FeedbackTargetType;
  targetId: string;
  traceId?: string | null;
  spanId?: string | null;
  requestId?: string | null;
  endUserId?: string | null;
  datasetExperimentId?: string | null;
  datasetRunId?: string | null;
  datasetItemIndex?: number | null;
  queueItemId?: string | null;
  evalRunId?: string | null;
  experimentRunId?: string | null;
  scoreConfigId?: string | null;
  dataType?: FeedbackDataType | null;
  score?: number | null;
  stringValue?: string | null;
  boolValue?: boolean | null;
  sentiment?: FeedbackSentiment | null;
  source: FeedbackSource;
  sessionId?: string | null;
  comment?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const humanFeedbackSchema = new Schema<IHumanFeedback>(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    targetType: {
      type: String,
      enum: ["trace", "span", "request", "session", "end_user", "dataset_item", "dataset_run_item", "experiment_result"],
      required: true,
      index: true,
    },
    targetId: { type: String, required: true },
    traceId: { type: String, default: null },
    spanId: { type: String, default: null },
    requestId: { type: String, default: null },
    endUserId: { type: String, default: null },
    datasetExperimentId: { type: String, default: null },
    datasetRunId: { type: String, default: null },
    datasetItemIndex: { type: Number, default: null },
    queueItemId: { type: String, default: null },
    evalRunId: { type: String, default: null },
    experimentRunId: { type: String, default: null },
    scoreConfigId: { type: String, default: null },
    dataType: {
      type: String,
      enum: ["numeric", "categorical", "boolean", "text", null],
      default: null,
    },
    score: { type: Number, default: null, min: 0, max: 100 },
    stringValue: { type: String, default: null },
    boolValue: { type: Boolean, default: null },
    sentiment: { type: String, enum: ["positive", "neutral", "negative", null], default: null },
    source: {
      type: String,
      enum: ["human", "judge", "api", "system", "annotation", "user_feedback", "evaluator"],
      default: "human",
    },
    sessionId: { type: String, default: null },
    comment: { type: String, default: "" },
    tags: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

humanFeedbackSchema.index({ userId: 1, traceId: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, sessionId: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, endUserId: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, spanId: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, requestId: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, targetType: 1, score: -1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, scoreConfigId: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, queueItemId: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, evalRunId: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, sentiment: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, tags: 1, createdAt: -1 });
humanFeedbackSchema.index({ userId: 1, datasetRunId: 1, datasetItemIndex: 1 });

export const HumanFeedback = mongoose.model<IHumanFeedback>(
  "HumanFeedback",
  humanFeedbackSchema,
);
