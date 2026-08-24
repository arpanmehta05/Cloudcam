import { AppError } from "../../../core/errors";
import { AiSavedView, type AiSavedViewType } from "../../../models/ai-saved-view.model";
import type { FeedbackScope } from "./feedback.service";

export interface SavedViewInput {
  name?: string;
  viewType?: AiSavedViewType;
  query?: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort?: Record<string, unknown>;
  isDefault?: boolean;
  actorId?: string;
}

function badRequest(message: string): AppError {
  return new AppError({ code: "ERR_BAD_REQUEST", message, status: 400 });
}

function pickViewType(value: unknown): AiSavedViewType {
  if (value === "traces" || value === "observations") return value;
  throw badRequest("viewType must be traces or observations");
}

function pickObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function pickColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 40);
}

function normalizeInput(input: SavedViewInput) {
  if (!input.name?.trim()) throw badRequest("name is required");
  return {
    name: input.name.trim().slice(0, 120),
    viewType: pickViewType(input.viewType),
    query: typeof input.query === "string" ? input.query.slice(0, 1000) : "",
    filters: pickObject(input.filters),
    columns: pickColumns(input.columns),
    sort: pickObject(input.sort),
    isDefault: input.isDefault === true,
  };
}

async function clearDefault(scope: FeedbackScope, viewType: AiSavedViewType, exceptId?: string) {
  const match: Record<string, unknown> = {
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
    viewType,
    isDefault: true,
  };
  if (exceptId) match._id = { $ne: exceptId };
  await AiSavedView.updateMany(match, { $set: { isDefault: false } });
}

export async function listSavedViews(scope: FeedbackScope, viewType?: unknown) {
  const match: Record<string, unknown> = {
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
  };
  if (viewType) match.viewType = pickViewType(viewType);
  const views = await AiSavedView.find(match).sort({ isDefault: -1, updatedAt: -1 }).lean();
  return { views };
}

export async function createSavedView(scope: FeedbackScope, input: SavedViewInput) {
  const normalized = normalizeInput(input);
  if (normalized.isDefault) await clearDefault(scope, normalized.viewType);
  const view = await AiSavedView.create({
    userId: scope.userId,
    tenantId: scope.tenantId || null,
    workspaceId: scope.workspaceId || null,
    ...normalized,
    createdBy: input.actorId || scope.userId,
    updatedBy: input.actorId || scope.userId,
  });
  return { view };
}

export async function updateSavedView(scope: FeedbackScope, id: string, input: SavedViewInput) {
  const existing = await AiSavedView.findOne({ _id: id, userId: scope.userId, workspaceId: scope.workspaceId || null });
  if (!existing) throw new AppError({ code: "ERR_NOT_FOUND", message: "Saved view not found", status: 404 });
  const update = {
    ...(input.name ? { name: input.name.trim().slice(0, 120) } : {}),
    ...(input.query !== undefined ? { query: String(input.query).slice(0, 1000) } : {}),
    ...(input.filters !== undefined ? { filters: pickObject(input.filters) } : {}),
    ...(input.columns !== undefined ? { columns: pickColumns(input.columns) } : {}),
    ...(input.sort !== undefined ? { sort: pickObject(input.sort) } : {}),
    ...(input.isDefault !== undefined ? { isDefault: input.isDefault === true } : {}),
    updatedBy: input.actorId || scope.userId,
  };
  if (update.isDefault) await clearDefault(scope, existing.viewType, id);
  const view = await AiSavedView.findOneAndUpdate(
    { _id: id, userId: scope.userId, workspaceId: scope.workspaceId || null },
    { $set: update },
    { new: true },
  );
  return { view };
}

export async function deleteSavedView(scope: FeedbackScope, id: string) {
  const view = await AiSavedView.findOneAndDelete({
    _id: id,
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
  });
  if (!view) throw new AppError({ code: "ERR_NOT_FOUND", message: "Saved view not found", status: 404 });
  return { deleted: true, id };
}
