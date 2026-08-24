import mongoose, { Document, Schema } from "mongoose";

export type FeatureType = "boolean";

export interface IFeature extends Document {
  key: string; // e.g. "ai_observability" — stable id used in plans/overrides
  name: string; // human label, e.g. "AI Observability"
  description?: string | null;
  type: FeatureType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The feature registry. Registering a feature here once makes it appear in
 * every plan editor and every tenant's entitlement toggles automatically —
 * adding a future feature is data, not code.
 */
const featureSchema = new Schema<IFeature>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    type: { type: String, enum: ["boolean"], default: "boolean" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Feature = mongoose.model<IFeature>("Feature", featureSchema);
