import mongoose, { Schema, Document, Types } from "mongoose";

export type CloudWatcherPassFailStatus = "pass" | "fail" | "manual_review" | "not_run";

export interface ICloudWatcherReportTestResult extends Document {
  reportRef: Types.ObjectId;
  category: string;
  testName: string;
  input: unknown;
  output: unknown;
  passFailStatus: CloudWatcherPassFailStatus;
  notes: string;
  latencyMs?: number | null;
  costUsd?: number | null;
  citations?: unknown[];
  toolCalls?: unknown[];
  metadata?: Record<string, unknown> | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cloudWatcherReportTestResultSchema = new Schema<ICloudWatcherReportTestResult>(
  {
    reportRef: { type: Schema.Types.ObjectId, ref: "CloudWatcherReport", required: true, index: true },
    category: { type: String, required: true, trim: true, maxlength: 160, index: true },
    testName: { type: String, required: true, trim: true, maxlength: 240 },
    input: { type: Schema.Types.Mixed, required: true },
    output: { type: Schema.Types.Mixed, default: null },
    passFailStatus: {
      type: String,
      required: true,
      enum: ["pass", "fail", "manual_review", "not_run"],
      index: true,
    },
    notes: { type: String, required: true, maxlength: 4000 },
    latencyMs: { type: Number, default: null, min: 0 },
    costUsd: { type: Number, default: null, min: 0 },
    citations: { type: [Schema.Types.Mixed], default: undefined },
    toolCalls: { type: [Schema.Types.Mixed], default: undefined },
    metadata: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: "cw_report_test_results",
  },
);

cloudWatcherReportTestResultSchema.index({ reportRef: 1, category: 1 });
cloudWatcherReportTestResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CloudWatcherReportTestResult = mongoose.model<ICloudWatcherReportTestResult>(
  "CloudWatcherReportTestResult",
  cloudWatcherReportTestResultSchema,
);
