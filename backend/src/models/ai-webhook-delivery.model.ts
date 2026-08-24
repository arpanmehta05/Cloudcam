import mongoose, { Document, Schema } from "mongoose";
import type { WebhookEventType } from "./ai-webhook.model";

export type WebhookDeliveryStatus = "pending" | "success" | "failed" | "exhausted";

export interface IAiWebhookDelivery extends Document {
  userId: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  responseCode?: number | null;
  error?: string | null;
  nextRetryAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiWebhookDeliverySchema = new Schema<IAiWebhookDelivery>(
  {
    userId: { type: String, required: true },
    webhookId: { type: String, required: true, index: true },
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "success", "failed", "exhausted"], default: "pending" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    responseCode: { type: Number, default: null },
    error: { type: String, default: null },
    nextRetryAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

aiWebhookDeliverySchema.index({ status: 1, nextRetryAt: 1 });
aiWebhookDeliverySchema.index({ userId: 1, webhookId: 1, createdAt: -1 });

export const AiWebhookDelivery = mongoose.model<IAiWebhookDelivery>(
  "AiWebhookDelivery",
  aiWebhookDeliverySchema,
);
