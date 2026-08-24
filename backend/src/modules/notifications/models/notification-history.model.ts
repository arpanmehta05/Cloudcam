import mongoose, { Schema, Document } from "mongoose";

export interface INotificationChannelStatus {
  status: "sent" | "failed" | "not_configured";
  error?: string;
}

export interface INotificationHistory extends Document {
  userId: string;
  title: string;
  message: string;
  severity: string;
  channels: {
    email: INotificationChannelStatus;
    slack: INotificationChannelStatus;
    webhook: INotificationChannelStatus;
  };
  createdAt: Date;
  updatedAt: Date;
}

const notificationHistorySchema = new Schema<INotificationHistory>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, default: "medium" },
    channels: {
      email: {
        status: {
          type: String,
          enum: ["sent", "failed", "not_configured"],
          required: true,
        },
        error: { type: String },
      },
      slack: {
        status: {
          type: String,
          enum: ["sent", "failed", "not_configured"],
          required: true,
        },
        error: { type: String },
      },
      webhook: {
        status: {
          type: String,
          enum: ["sent", "failed", "not_configured"],
          required: true,
        },
        error: { type: String },
      },
    },
  },
  { timestamps: true }
);

// Indexes: lookup history for a user sorted by most recent first
notificationHistorySchema.index({ userId: 1, createdAt: -1 });

export const NotificationHistory = mongoose.model<INotificationHistory>(
  "NotificationHistory",
  notificationHistorySchema
);
