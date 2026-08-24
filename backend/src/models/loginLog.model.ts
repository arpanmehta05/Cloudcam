import mongoose, { Schema, Document } from "mongoose";

export interface ILoginLog extends Document {
  userId: mongoose.Types.ObjectId;
  provider: string;
  ip: string;
  userAgent: string;
  loggedAt: Date;
}

const loginLogSchema = new Schema<ILoginLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: { type: String, required: true },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    loggedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: false,
  },
);

// TTL index to automatically expire documents after 30 days (30 * 24 * 60 * 60 = 2592000 seconds)
loginLogSchema.index({ loggedAt: 1 }, { expireAfterSeconds: 2592000 });

export const LoginLog = mongoose.model<ILoginLog>("LoginLog", loginLogSchema);
