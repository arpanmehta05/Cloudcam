import mongoose, { Schema, Document } from "mongoose";

export interface ICloudWatcherAgent extends Document {
  accountId: string;
  agentId: string;
  displayName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const cloudWatcherAgentSchema = new Schema<ICloudWatcherAgent>(
  {
    accountId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, trim: true, maxlength: 160 },
    displayName: { type: String, default: null, trim: true, maxlength: 200 },
  },
  {
    timestamps: true,
    collection: "cw_agents",
  },
);

cloudWatcherAgentSchema.index({ accountId: 1, agentId: 1 }, { unique: true });
cloudWatcherAgentSchema.index({ accountId: 1, createdAt: -1 });

export const CloudWatcherAgent = mongoose.model<ICloudWatcherAgent>(
  "CloudWatcherAgent",
  cloudWatcherAgentSchema,
);
