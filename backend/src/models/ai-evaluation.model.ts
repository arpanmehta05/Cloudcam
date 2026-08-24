// ─── AI Observability: Evaluation Layer Model (LLM-as-a-Judge) ───
import mongoose, { Schema, Document } from "mongoose";

export interface IEvaluationMetric {
  name: string; // e.g. hallucination, toxicity, safety, relevance
  score: number; // 0.0 to 1.0 (or 0 to 100)
  passed: boolean;
  reasoning?: string;
}

export interface IAiEvaluation extends Document {
  userId: string;
  requestId?: string; // Link to AiRequestLog
  traceId?: string; // Link to AiTrace
  spanId?: string; // Link to AiTraceSpan
  status: "pass" | "fail";
  score: number; // Overall normalized score 0-100
  metrics: IEvaluationMetric[];
  reasoning?: string;
  judgeModel: string;
  createdAt: Date;
  updatedAt: Date;
}

const evaluationMetricSchema = new Schema<IEvaluationMetric>(
  {
    name: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    passed: { type: Boolean, required: true },
    reasoning: { type: String, default: "" },
  },
  { _id: false },
);

const aiEvaluationSchema = new Schema<IAiEvaluation>(
  {
    userId: { type: String, required: true },
    requestId: { type: String, default: null },
    traceId: { type: String, default: null },
    spanId: { type: String, default: null },
    status: {
      type: String,
      enum: ["pass", "fail"],
      required: true,
      default: "pass",
    },
    score: { type: Number, required: true, default: 100 },
    metrics: { type: [evaluationMetricSchema], default: [] },
    reasoning: { type: String, default: "" },
    judgeModel: { type: String, required: true, default: "gemini-2.5-flash" },
  },
  { timestamps: true },
);

// Indexes
aiEvaluationSchema.index({ userId: 1, createdAt: -1 });
aiEvaluationSchema.index({ userId: 1, status: 1 });
aiEvaluationSchema.index({ requestId: 1 });
aiEvaluationSchema.index({ traceId: 1 });

export const AiEvaluation = mongoose.model<IAiEvaluation>(
  "AiEvaluation",
  aiEvaluationSchema,
);
