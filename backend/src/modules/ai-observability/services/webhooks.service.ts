import crypto from "crypto";
import { AppError } from "../../../core/errors";
import { AiWebhook, type IAiWebhook, type WebhookEventType } from "../../../models/ai-webhook.model";
import { AiWebhookDelivery } from "../../../models/ai-webhook-delivery.model";
import { recordAudit } from "./audit.service";
import type { FeedbackScope } from "./feedback.service";

const KNOWN_EVENTS: WebhookEventType[] = [
  "*",
  "trace.ingested",
  "trace.error",
  "prompt.deployed",
  "evaluation.completed",
  "budget.exceeded",
  "comment.created",
];

const MAX_ATTEMPTS = 5;

function badRequest(message: string): AppError {
  return new AppError({ code: "ERR_BAD_REQUEST", message, status: 400 });
}

function notFound(): AppError {
  return new AppError({ code: "ERR_NOT_FOUND", message: "Webhook not found", status: 404 });
}

/** Pure: canonical HMAC-SHA256 signature over `${timestamp}.${body}`. */
export function signWebhookPayload(secret: string, timestamp: number, body: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Pure: exponential backoff with jitterless cap. attempt is 1-based. */
export function computeNextRetryDelayMs(attempt: number): number {
  const base = 1000; // 1s
  const cap = 60 * 60 * 1000; // 1 hour
  return Math.min(cap, base * Math.pow(3, Math.max(0, attempt - 1)));
}

/** Pure: does a webhook's subscription list match the emitted event type? */
export function webhookMatchesEvent(events: string[], eventType: string): boolean {
  return events.includes("*") || events.includes(eventType);
}

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

function validateUrl(url: unknown): string {
  if (typeof url !== "string") throw badRequest("url is required");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw badRequest("url must be a valid absolute URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw badRequest("url must use http(s)");
  }
  return parsed.toString();
}

function validateEvents(events: unknown): WebhookEventType[] {
  if (!Array.isArray(events) || events.length === 0) return ["*"];
  const picked = events.filter(
    (event): event is WebhookEventType => typeof event === "string" && KNOWN_EVENTS.includes(event as WebhookEventType),
  );
  if (picked.length === 0) throw badRequest("events must include at least one known event type");
  return Array.from(new Set(picked));
}

/** Strip the secret before returning a webhook to the client. */
function redact(webhook: IAiWebhook) {
  const obj = webhook.toObject ? webhook.toObject() : webhook;
  return { ...obj, secret: undefined, secretSet: Boolean(obj.secret) };
}

export async function listWebhooks(scope: FeedbackScope) {
  const webhooks = await AiWebhook.find({
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
  }).sort({ updatedAt: -1 });
  return { webhooks: webhooks.map(redact) };
}

export interface WebhookInput {
  url?: unknown;
  description?: string | null;
  events?: unknown;
  enabled?: boolean;
  actorId?: string;
}

export async function createWebhook(scope: FeedbackScope, input: WebhookInput) {
  const url = validateUrl(input.url);
  const events = validateEvents(input.events);
  const secret = generateSecret();
  const webhook = await AiWebhook.create({
    userId: scope.userId,
    tenantId: scope.tenantId || null,
    workspaceId: scope.workspaceId || null,
    url,
    description: input.description || null,
    secret,
    events,
    enabled: input.enabled !== false,
    createdBy: input.actorId || scope.userId,
    updatedBy: input.actorId || scope.userId,
  });
  await recordAudit(scope, {
    actorId: input.actorId || scope.userId,
    action: "webhook.create",
    resourceType: "webhook",
    resourceId: String(webhook._id),
    resourceName: url,
    metadata: { events },
  });
  // Secret is shown once at creation time so the caller can store it.
  return { webhook: redact(webhook), secret };
}

export async function updateWebhook(scope: FeedbackScope, id: string, input: WebhookInput) {
  const webhook = await AiWebhook.findOne({ _id: id, userId: scope.userId, workspaceId: scope.workspaceId || null });
  if (!webhook) throw notFound();
  if (input.url !== undefined) webhook.url = validateUrl(input.url);
  if (input.events !== undefined) webhook.events = validateEvents(input.events);
  if (input.description !== undefined) webhook.description = input.description || null;
  if (input.enabled !== undefined) webhook.enabled = input.enabled;
  webhook.updatedBy = input.actorId || scope.userId;
  await webhook.save();
  return { webhook: redact(webhook) };
}

export async function rotateWebhookSecret(scope: FeedbackScope, id: string, actorId?: string) {
  const webhook = await AiWebhook.findOne({ _id: id, userId: scope.userId, workspaceId: scope.workspaceId || null });
  if (!webhook) throw notFound();
  const secret = generateSecret();
  webhook.secret = secret;
  webhook.updatedBy = actorId || scope.userId;
  await webhook.save();
  await recordAudit(scope, {
    actorId: actorId || scope.userId,
    action: "webhook.rotate",
    resourceType: "webhook",
    resourceId: id,
    resourceName: webhook.url,
  });
  return { webhook: redact(webhook), secret };
}

export async function deleteWebhook(scope: FeedbackScope, id: string, actorId?: string) {
  const webhook = await AiWebhook.findOneAndDelete({
    _id: id,
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
  });
  if (!webhook) throw notFound();
  await recordAudit(scope, {
    actorId: actorId || scope.userId,
    action: "webhook.delete",
    resourceType: "webhook",
    resourceId: id,
    resourceName: webhook.url,
  });
  return { deleted: true, id };
}

export async function listDeliveries(scope: FeedbackScope, webhookId: string, limit = 50) {
  const bounded = Math.min(Math.max(limit, 1), 200);
  const deliveries = await AiWebhookDelivery.find({ userId: scope.userId, webhookId })
    .sort({ createdAt: -1 })
    .limit(bounded)
    .lean();
  return { deliveries };
}

/** Attempt a single HTTP delivery, updating the delivery + webhook records. */
async function attemptDelivery(webhook: IAiWebhook, deliveryId: string): Promise<void> {
  const delivery = await AiWebhookDelivery.findById(deliveryId);
  if (!delivery || delivery.status === "success") return;

  const timestamp = Date.now();
  const body = JSON.stringify({
    event: delivery.eventType,
    timestamp,
    data: delivery.payload,
  });
  const signature = signWebhookPayload(webhook.secret, timestamp, body);
  delivery.attempts += 1;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rabbittwatch-event": delivery.eventType,
        "x-rabbittwatch-timestamp": String(timestamp),
        "x-rabbittwatch-signature": signature,
      },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    delivery.responseCode = response.status;
    if (response.ok) {
      delivery.status = "success";
      delivery.deliveredAt = new Date();
      delivery.nextRetryAt = null;
      webhook.lastStatus = "success";
      webhook.lastDeliveredAt = new Date();
      webhook.failureCount = 0;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    delivery.error = error instanceof Error ? error.message : String(error);
    if (delivery.attempts >= delivery.maxAttempts) {
      delivery.status = "exhausted";
      delivery.nextRetryAt = null;
    } else {
      delivery.status = "failed";
      delivery.nextRetryAt = new Date(Date.now() + computeNextRetryDelayMs(delivery.attempts));
    }
    webhook.lastStatus = "failed";
    webhook.failureCount += 1;
  }
  await delivery.save();
  await webhook.save();
}

/**
 * Emit an event to all matching enabled webhooks for a scope. Fire-and-forget:
 * never throws so it can be safely called from hot paths. Best-effort immediate
 * delivery; failures are persisted for `retryPendingWebhookDeliveries`.
 */
export async function emitWebhookEvent(
  scope: Pick<FeedbackScope, "userId" | "workspaceId">,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const webhooks = await AiWebhook.find({
      userId: scope.userId,
      workspaceId: scope.workspaceId || null,
      enabled: true,
    });
    const matching = webhooks.filter((webhook) => webhookMatchesEvent(webhook.events, eventType));
    await Promise.all(
      matching.map(async (webhook) => {
        const delivery = await AiWebhookDelivery.create({
          userId: scope.userId,
          webhookId: String(webhook._id),
          eventType,
          payload,
          status: "pending",
          maxAttempts: MAX_ATTEMPTS,
        });
        await attemptDelivery(webhook, String(delivery._id));
      }),
    );
  } catch (error) {
    console.error("[webhooks] emit failed:", error);
  }
}

/** Send a synthetic test event to verify a webhook endpoint. */
export async function sendTestEvent(scope: FeedbackScope, id: string) {
  const webhook = await AiWebhook.findOne({ _id: id, userId: scope.userId, workspaceId: scope.workspaceId || null });
  if (!webhook) throw notFound();
  const delivery = await AiWebhookDelivery.create({
    userId: scope.userId,
    webhookId: String(webhook._id),
    eventType: "*",
    payload: { test: true, message: "RabbittWatch webhook test event" },
    status: "pending",
    maxAttempts: 1,
  });
  await attemptDelivery(webhook, String(delivery._id));
  const saved = await AiWebhookDelivery.findById(delivery._id).lean();
  return { delivery: saved };
}

/** Worker entry point: retry deliveries whose backoff window has elapsed. */
export async function retryPendingWebhookDeliveries(now = new Date()): Promise<{ retried: number }> {
  const due = await AiWebhookDelivery.find({
    status: "failed",
    nextRetryAt: { $lte: now },
  }).limit(100);
  let retried = 0;
  for (const delivery of due) {
    const webhook = await AiWebhook.findById(delivery.webhookId);
    if (!webhook || !webhook.enabled) {
      delivery.status = "exhausted";
      await delivery.save();
      continue;
    }
    await attemptDelivery(webhook, String(delivery._id));
    retried += 1;
  }
  return { retried };
}
