import mongoose, { Document, Schema } from "mongoose";

/** Event types a webhook can subscribe to. `*` matches everything. */
export type WebhookEventType =
  | "*"
  | "trace.ingested"
  | "trace.error"
  | "prompt.deployed"
  | "evaluation.completed"
  | "budget.exceeded"
  | "comment.created";

export interface IAiWebhook extends Document {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  url: string;
  description?: string | null;
  /** HMAC-SHA256 signing secret. Never returned in list responses. */
  secret: string;
  events: WebhookEventType[];
  enabled: boolean;
  lastStatus?: "success" | "failed" | null;
  lastDeliveredAt?: Date | null;
  failureCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiWebhookSchema = new Schema<IAiWebhook>(
  {
    userId: { type: String, required: true },
    tenantId: { type: String, default: null },
    workspaceId: { type: String, default: null },
    url: { type: String, required: true },
    description: { type: String, default: null },
    secret: { type: String, required: true },
    events: { type: [String], default: ["*"] },
    enabled: { type: Boolean, default: true },
    lastStatus: { type: String, default: null },
    lastDeliveredAt: { type: Date, default: null },
    failureCount: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

aiWebhookSchema.index({ userId: 1, workspaceId: 1, enabled: 1 });

export const AiWebhook = mongoose.model<IAiWebhook>("AiWebhook", aiWebhookSchema);
