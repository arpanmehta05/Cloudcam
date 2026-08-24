import mongoose, { Schema, Document } from "mongoose";

export interface IGcpInventoryCache extends Document {
  workspaceId: mongoose.Types.ObjectId;
  region: string;
  inventory: any;
  lastUpdated: Date;
}

const GcpInventoryCacheSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    region: { type: String, required: true },
    inventory: { type: Schema.Types.Mixed, required: true },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

GcpInventoryCacheSchema.index({ workspaceId: 1, region: 1 }, { unique: true });

export const GcpInventoryCacheModel = mongoose.model<IGcpInventoryCache>(
  "GcpInventoryCache",
  GcpInventoryCacheSchema,
);
