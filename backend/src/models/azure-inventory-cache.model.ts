import mongoose, { Schema, Document } from "mongoose";

export interface IAzureInventoryCache extends Document {
  workspaceId: mongoose.Types.ObjectId;
  region: string;
  inventory: any;
  lastUpdated: Date;
}

const AzureInventoryCacheSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    region: { type: String, required: true },
    inventory: { type: Schema.Types.Mixed, required: true },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Compound index for fast lookups by workspace and region
AzureInventoryCacheSchema.index(
  { workspaceId: 1, region: 1 },
  { unique: true },
);

export const AzureInventoryCacheModel = mongoose.model<IAzureInventoryCache>(
  "AzureInventoryCache",
  AzureInventoryCacheSchema,
);
