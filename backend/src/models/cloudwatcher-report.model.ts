import mongoose, { Schema, Document, Types } from "mongoose";

export type CloudWatcherSystemType = "raw-llm-api" | "rag-pipeline" | "agent-tools" | "chatbot";
export type CloudWatcherReportStatus = "pending_score" | "scored" | "invalid";

export interface ICloudWatcherReport extends Document {
  agentRef: Types.ObjectId;
  accountId: string;
  systemType: CloudWatcherSystemType;
  skillName: string;
  skillVersion: string;
  submittedAt: Date;
  rawReportJson: unknown;
  status: CloudWatcherReportStatus;
  score?: number | null;
  /** Evidence-adjusted score per category (0..1). Populated after scoring completes. */
  categoryScores?: Map<string, number>;
  /** The actual score cap applied by the backend (0..1). null means no cap was triggered. */
  appliedScoreCap?: number | null;
  /** Raw evidence-adjusted score before any harness cap was applied (0..1). */
  rawScoreBeforeCap?: number | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cloudWatcherReportSchema = new Schema<ICloudWatcherReport>(
  {
    agentRef: { type: Schema.Types.ObjectId, ref: "CloudWatcherAgent", required: true, index: true },
    accountId: { type: String, required: true, index: true },
    systemType: {
      type: String,
      required: true,
      enum: ["raw-llm-api", "rag-pipeline", "agent-tools", "chatbot"],
    },
    skillName: { type: String, required: true, trim: true, maxlength: 160 },
    skillVersion: { type: String, required: true, trim: true, maxlength: 40 },
    submittedAt: { type: Date, required: true, default: Date.now },
    rawReportJson: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending_score", "scored", "invalid"],
      default: "pending_score",
      index: true,
    },
    score: { type: Number, default: null, min: 0, max: 1 },
    categoryScores: { type: Map, of: Number, default: () => ({}) },
    appliedScoreCap: { type: Number, default: null, min: 0, max: 1 },
    rawScoreBeforeCap: { type: Number, default: null, min: 0, max: 1 },
  },
  {
    timestamps: true,
    collection: "cw_reports",
  },
);

cloudWatcherReportSchema.index({ accountId: 1, submittedAt: -1 });
cloudWatcherReportSchema.index({ agentRef: 1, submittedAt: -1 });
cloudWatcherReportSchema.index({ status: 1, submittedAt: 1 });
cloudWatcherReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CloudWatcherReport = mongoose.model<ICloudWatcherReport>(
  "CloudWatcherReport",
  cloudWatcherReportSchema,
);
