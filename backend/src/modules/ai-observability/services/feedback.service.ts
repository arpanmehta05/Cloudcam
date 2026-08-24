import { AppError } from "../../../core/errors";
import {
  HumanFeedback,
  type FeedbackDataType,
  type FeedbackSentiment,
  type FeedbackSource,
  type FeedbackTargetType,
} from "../../../models/human-feedback.model";
import { ScoreConfig } from "../../../models/score-config.model";
import { refreshFeedbackSummary } from "./feedback-summary.service";

export interface FeedbackScope {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
}

export interface FeedbackInput {
  targetType: FeedbackTargetType;
  targetId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  endUserId?: string;
  datasetExperimentId?: string;
  datasetRunId?: string;
  datasetItemIndex?: number;
  queueItemId?: string;
  evalRunId?: string;
  experimentRunId?: string;
  scoreConfigId?: string;
  dataType?: FeedbackDataType;
  score?: number;
  stringValue?: string;
  boolValue?: boolean;
  source?: FeedbackSource;
  sessionId?: string;
  sentiment?: FeedbackSentiment;
  comment?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  actorId?: string;
}

export interface FeedbackFilters {
  targetType?: FeedbackTargetType;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  sentiment?: FeedbackSentiment;
  tag?: string;
  page?: number;
  limit?: number;
}

function badRequest(message: string): AppError {
  return new AppError({ code: "ERR_BAD_REQUEST", message, status: 400 });
}

function resolveTarget(input: FeedbackInput): string {
  const id =
    input.targetId ||
    input.traceId ||
    input.spanId ||
    input.requestId ||
    input.datasetRunId;
  if (!input.targetType || !id) throw badRequest("targetType and target id are required");
  return id;
}

function targetFields(input: FeedbackInput, targetId: string) {
  return {
    traceId: input.traceId || (input.targetType === "trace" ? targetId : null),
    spanId: input.spanId || (input.targetType === "span" ? targetId : null),
    requestId: input.requestId || (input.targetType === "request" ? targetId : null),
    sessionId: input.sessionId || (input.targetType === "session" ? targetId : null),
    endUserId: input.endUserId || (input.targetType === "end_user" ? targetId : null),
  };
}

function normalizeSource(source: FeedbackSource | undefined): FeedbackSource {
  if (source === "annotation" || source === "user_feedback") return "human";
  if (source === "evaluator") return "judge";
  return source || "human";
}

function validateValue(dataType: FeedbackDataType, input: FeedbackInput) {
  if (dataType === "numeric" && typeof input.score !== "number") throw badRequest("numeric score is required");
  if (dataType === "categorical" && !input.stringValue?.trim()) throw badRequest("stringValue is required for categorical scores");
  if (dataType === "boolean" && typeof input.boolValue !== "boolean") throw badRequest("boolValue is required for boolean scores");
  if (dataType === "text" && !input.stringValue?.trim() && !input.comment?.trim()) {
    throw badRequest("stringValue or comment is required for text scores");
  }
}

async function resolveScore(scope: FeedbackScope, input: FeedbackInput): Promise<FeedbackDataType | null> {
  if (!input.scoreConfigId) {
    if (input.dataType) validateValue(input.dataType, input);
    return input.dataType || null;
  }
  const config = await ScoreConfig.findOne({
    _id: input.scoreConfigId,
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
    isArchived: false,
  }).lean();
  if (!config) throw badRequest("scoreConfigId is invalid");
  validateValue(config.dataType, input);
  if (config.dataType === "numeric") {
    const score = Number(input.score);
    if (config.minValue != null && score < config.minValue) throw badRequest("score is below minValue");
    if (config.maxValue != null && score > config.maxValue) throw badRequest("score is above maxValue");
  }
  if (config.dataType === "categorical" && !config.categories.includes(input.stringValue || "")) {
    throw badRequest("stringValue must match a configured category");
  }
  return config.dataType;
}

export async function submitFeedback(scope: FeedbackScope, input: FeedbackInput) {
  const targetId = resolveTarget(input);
  if (typeof input.score === "number" && (input.score < 0 || input.score > 100)) {
    throw badRequest("score must be between 0 and 100");
  }
  const dataType = await resolveScore(scope, input);
  const targets = targetFields(input, targetId);

  const feedback = await HumanFeedback.create({
    userId: scope.userId,
    tenantId: scope.tenantId || null,
    workspaceId: scope.workspaceId || null,
    targetType: input.targetType,
    targetId,
    ...targets,
    datasetExperimentId: input.datasetExperimentId || null,
    datasetRunId: input.datasetRunId || null,
    datasetItemIndex: input.datasetItemIndex ?? null,
    queueItemId: input.queueItemId || null,
    evalRunId: input.evalRunId || null,
    experimentRunId: input.experimentRunId || null,
    scoreConfigId: input.scoreConfigId || null,
    dataType,
    score: input.score ?? null,
    stringValue: input.stringValue || null,
    boolValue: input.boolValue ?? null,
    source: normalizeSource(input.source),
    sentiment: input.sentiment || null,
    comment: input.comment || "",
    tags: input.tags || [],
    metadata: input.metadata || {},
    createdBy: input.actorId || scope.userId,
  });

  const summary = await refreshFeedbackSummary({
    userId: scope.userId,
    targetType: input.targetType,
    targetId,
    traceId: targets.traceId,
    spanId: targets.spanId,
    requestId: targets.requestId,
  });

  return { feedback, summary };
}

export async function listFeedback(scope: FeedbackScope, filters: FeedbackFilters) {
  const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
  const page = Math.max(filters.page || 1, 1);
  const match: Record<string, unknown> = { userId: scope.userId };
  if (filters.targetType) match.targetType = filters.targetType;
  if (filters.traceId) match.traceId = filters.traceId;
  if (filters.spanId) match.spanId = filters.spanId;
  if (filters.requestId) match.requestId = filters.requestId;
  if (filters.sentiment) match.sentiment = filters.sentiment;
  if (filters.tag) match.tags = filters.tag;

  const [feedback, total] = await Promise.all([
    HumanFeedback.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    HumanFeedback.countDocuments(match),
  ]);
  return { feedback, total, page, limit, pages: Math.ceil(total / limit) };
}
