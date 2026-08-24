import mongoose, { Document, Schema } from "mongoose";

export interface ISlackActiveSession extends Document {
  slackUserId: string;
  channelId: string;
  threadTs: string;
  pendingAlarm: Record<string, any>;
  missingFields: string[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const slackActiveSessionSchema = new Schema<ISlackActiveSession>(
  {
    slackUserId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    threadTs: { type: String, required: true, index: true },
    pendingAlarm: { type: Schema.Types.Mixed, default: {} },
    missingFields: { type: [String], default: [] },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // MongoDB TTL index to auto-delete expired sessions
  },
  { timestamps: true },
);

// Unique index to prevent duplicate sessions on the same thread
slackActiveSessionSchema.index({ channelId: 1, threadTs: 1 }, { unique: true });

export const SlackActiveSession = mongoose.model<ISlackActiveSession>(
  "SlackActiveSession",
  slackActiveSessionSchema,
);
