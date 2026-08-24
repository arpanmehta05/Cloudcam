import { AppError } from "../../../core/errors";
import {
  AnnotationMetadata,
  type AnnotationSeverity,
  type AnnotationStatus,
  type AnnotationTargetType,
} from "../../../models/annotation-metadata.model";
import type { FeedbackScope } from "../services/feedback.service";

export interface AnnotationInput {
  targetType: AnnotationTargetType;
  targetId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  status?: AnnotationStatus;
  severity?: AnnotationSeverity;
  ownerId?: string;
  notes?: string;
  tags?: string[];
  labels?: Record<string, string>;
  feedbackIds?: string[];
  actorId?: string;
}

function badRequest(message: string): AppError {
  return new AppError({ code: "ERR_BAD_REQUEST", message, status: 400 });
}

function resolveTarget(input: AnnotationInput): string {
  const id = input.targetId || input.traceId || input.spanId || input.requestId;
  if (!input.targetType || !id) throw badRequest("targetType and target id are required");
  return id;
}

export async function upsertAnnotation(scope: FeedbackScope, input: AnnotationInput) {
  const targetId = resolveTarget(input);
  const update = {
    $set: {
      tenantId: scope.tenantId || null,
      workspaceId: scope.workspaceId || null,
      traceId: input.traceId || (input.targetType === "trace" ? targetId : null),
      spanId: input.spanId || (input.targetType === "span" ? targetId : null),
      requestId: input.requestId || (input.targetType === "request" ? targetId : null),
      status: input.status || "open",
      severity: input.severity || null,
      ownerId: input.ownerId || null,
      notes: input.notes || "",
      tags: input.tags || [],
      labels: input.labels || {},
      feedbackIds: input.feedbackIds || [],
      updatedBy: input.actorId || scope.userId,
    },
    $setOnInsert: { userId: scope.userId, targetType: input.targetType, targetId, createdBy: input.actorId || scope.userId },
  };
  return AnnotationMetadata.findOneAndUpdate(
    { userId: scope.userId, targetType: input.targetType, targetId },
    update,
    { new: true, upsert: true },
  );
}

export async function listAnnotations(scope: FeedbackScope, filters: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const page = Math.max(Number(filters.page) || 1, 1);
  const match: Record<string, unknown> = { userId: scope.userId };
  if (filters.status) match.status = filters.status;
  if (filters.severity) match.severity = filters.severity;
  if (filters.traceId) match.traceId = filters.traceId;
  if (filters.tag) match.tags = filters.tag;
  const [annotations, total] = await Promise.all([
    AnnotationMetadata.find(match).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AnnotationMetadata.countDocuments(match),
  ]);
  return { annotations, total, page, limit, pages: Math.ceil(total / limit) };
}
