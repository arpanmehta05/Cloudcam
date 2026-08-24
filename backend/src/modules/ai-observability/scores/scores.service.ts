import { AppError } from "../../../core/errors";
import {
  ScoreConfig,
  type ScoreConfigDataType,
} from "../../../models/score-config.model";
import type { FeedbackScope } from "../services/feedback.service";

export interface ScoreConfigInput {
  name?: string;
  dataType?: ScoreConfigDataType;
  minValue?: number | null;
  maxValue?: number | null;
  categories?: string[];
  description?: string;
  actorId?: string;
}

function badRequest(message: string): AppError {
  return new AppError({ code: "ERR_BAD_REQUEST", message, status: 400 });
}

function validate(input: ScoreConfigInput) {
  if (!input.name?.trim()) throw badRequest("name is required");
  if (!input.dataType) throw badRequest("dataType is required");
  if (input.dataType === "numeric" && input.minValue != null && input.maxValue != null) {
    if (input.minValue >= input.maxValue) throw badRequest("minValue must be less than maxValue");
  }
  if (input.dataType === "categorical" && (!input.categories || input.categories.length === 0)) {
    throw badRequest("categories are required for categorical scores");
  }
}

export async function listScoreConfigs(scope: FeedbackScope) {
  const scoreConfigs = await ScoreConfig.find({
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
    isArchived: false,
  }).sort({ name: 1 }).lean();
  return { scoreConfigs };
}

export async function createScoreConfig(scope: FeedbackScope, input: ScoreConfigInput) {
  validate(input);
  const scoreConfig = await ScoreConfig.create({
    userId: scope.userId,
    tenantId: scope.tenantId || null,
    workspaceId: scope.workspaceId || null,
    name: input.name?.trim(),
    dataType: input.dataType,
    minValue: input.minValue ?? null,
    maxValue: input.maxValue ?? null,
    categories: input.categories || [],
    description: input.description || "",
    createdBy: input.actorId || scope.userId,
    updatedBy: input.actorId || scope.userId,
  });
  return { scoreConfig };
}

export async function updateScoreConfig(scope: FeedbackScope, id: string, input: ScoreConfigInput) {
  const update = {
    ...(input.name ? { name: input.name.trim() } : {}),
    ...(input.dataType ? { dataType: input.dataType } : {}),
    ...(input.minValue !== undefined ? { minValue: input.minValue } : {}),
    ...(input.maxValue !== undefined ? { maxValue: input.maxValue } : {}),
    ...(input.categories ? { categories: input.categories } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    updatedBy: input.actorId || scope.userId,
  };
  const scoreConfig = await ScoreConfig.findOneAndUpdate(
    { _id: id, userId: scope.userId },
    { $set: update },
    { new: true },
  );
  if (!scoreConfig) throw new AppError({ code: "ERR_NOT_FOUND", message: "Score config not found", status: 404 });
  return { scoreConfig };
}

export async function archiveScoreConfig(scope: FeedbackScope, id: string) {
  const scoreConfig = await ScoreConfig.findOneAndUpdate(
    { _id: id, userId: scope.userId },
    { $set: { isArchived: true } },
    { new: true },
  );
  if (!scoreConfig) throw new AppError({ code: "ERR_NOT_FOUND", message: "Score config not found", status: 404 });
  return { scoreConfig };
}
