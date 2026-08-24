// ─── AI Observability: Prompt Templates Model ───
import mongoose, { Schema, Document } from "mongoose";

export interface IPromptVersion {
  version: number;
  template: string;
  systemPrompt?: string;
  provider: string;
  model: string;
  endpoint?: string;
  temperature: number;
  maxTokens: number;
  createdAt: Date;
}

export interface IAiPromptTemplate extends Document {
  userId: string;
  name: string;
  description?: string;
  variables: string[];
  versions: IPromptVersion[];
  activeVersion: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const promptVersionSchema = new Schema<IPromptVersion>(
  {
    version: { type: Number, required: true },
    template: { type: String, required: true },
    systemPrompt: { type: String, default: "" },
    provider: { type: String, required: true, default: "openai" },
    model: { type: String, required: true, default: "gpt-4o" },
    endpoint: { type: String, default: "" },
    temperature: { type: Number, required: true, default: 0.7 },
    maxTokens: { type: Number, required: true, default: 256 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const aiPromptTemplateSchema = new Schema<IAiPromptTemplate>(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    variables: { type: [String], default: [] },
    versions: { type: [promptVersionSchema], default: [] },
    activeVersion: { type: Number, default: 1 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Indexes
aiPromptTemplateSchema.index({ userId: 1, name: 1 }, { unique: true });
aiPromptTemplateSchema.index({ userId: 1, createdAt: -1 });

export const AiPromptTemplate = mongoose.model<IAiPromptTemplate>(
  "AiPromptTemplate",
  aiPromptTemplateSchema,
);
