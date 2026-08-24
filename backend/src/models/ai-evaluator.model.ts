import mongoose, { Document, Schema } from "mongoose";

export type EvaluatorType = "llm_judge" | "code" | "human";
export type EvaluatorStatus = "active" | "archived";

export interface IAiEvaluator extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  slug: string;
  name: string;
  description?: string;
  type: EvaluatorType;
  scoreName?: string | null;
  /** Config shape depends on type: code evaluator params or judge params. */
  config: Record<string, unknown>;
  /** Scope filters for online evaluation targeting. */
  scope: {
    environments?: string[];
    providers?: string[];
    models?: string[];
    prompts?: string[];
    endpoints?: string[];
    tags?: string[];
  };
  /** Online evaluation controls. */
  online: {
    enabled: boolean;
    samplingRate: number;
    triggers: string[];
    maxCostPerDay?: number | null;
  };
  status: EvaluatorStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiEvaluatorSchema = new Schema<IAiEvaluator>(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: "", maxlength: 4000 },
    type: { type: String, enum: ["llm_judge", "code", "human"], required: true },
    scoreName: { type: String, default: null },
    config: { type: Schema.Types.Mixed, default: {} },
    scope: {
      environments: { type: [String], default: [] },
      providers: { type: [String], default: [] },
      models: { type: [String], default: [] },
      prompts: { type: [String], default: [] },
      endpoints: { type: [String], default: [] },
      tags: { type: [String], default: [] },
    },
    online: {
      enabled: { type: Boolean, default: false },
      samplingRate: { type: Number, default: 0.1, min: 0, max: 1 },
      triggers: { type: [String], default: [] },
      maxCostPerDay: { type: Number, default: null },
    },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

aiEvaluatorSchema.index({ userId: 1, workspaceId: 1, slug: 1 }, { unique: true });
aiEvaluatorSchema.index({ userId: 1, status: 1, updatedAt: -1 });
aiEvaluatorSchema.index({ userId: 1, type: 1 });
aiEvaluatorSchema.index({ userId: 1, "online.enabled": 1 });

export const AiEvaluator = mongoose.model<IAiEvaluator>("AiEvaluator", aiEvaluatorSchema);
