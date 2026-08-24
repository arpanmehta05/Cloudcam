import { ProjectionType } from "mongoose";
import { AiTraceSpan, IAiTraceSpan } from "../../../models/ai-trace-span.model";
import { AiScope, buildScopeMatch } from "./scope.service";

type ObservationFieldGroup = "core" | "basic" | "usage" | "input" | "output" | "metadata";
type ObservationMatch = Record<string, unknown>;

export interface ObservationQuery {
  traceId?: unknown;
  sessionId?: unknown;
  endUserId?: unknown;
  kind?: unknown;
  provider?: unknown;
  modelName?: unknown;
  status?: unknown;
  level?: unknown;
  environment?: unknown;
  serviceName?: unknown;
  endpoint?: unknown;
  promptName?: unknown;
  promptSlug?: unknown;
  promptVersion?: unknown;
  promptLabel?: unknown;
  promptEnvironment?: unknown;
  minLatencyMs?: unknown;
  maxLatencyMs?: unknown;
  minCost?: unknown;
  maxCost?: unknown;
  tag?: unknown;
  fields?: unknown;
  limit?: unknown;
  cursor?: unknown;
}

const fieldGroups: Record<ObservationFieldGroup, string[]> = {
  core: [
    "traceId",
    "spanId",
    "parentSpanId",
    "name",
    "kind",
    "status",
    "level",
    "startedAt",
    "durationMs",
  ],
  basic: [
    "tenantId",
    "workspaceId",
    "environment",
    "serviceName",
    "endpoint",
    "provider",
    "modelName",
    "sessionId",
    "endUserId",
    "promptName",
    "promptSlug",
    "promptVersion",
    "promptLabel",
    "promptEnvironment",
    "tags",
  ],
  usage: [
    "promptTokens",
    "completionTokens",
    "totalTokens",
    "cost",
    "completionStartTime",
  ],
  input: ["inputPreview"],
  output: ["outputPreview", "errorMessage", "statusMessage"],
  metadata: ["metadata", "modelParameters", "feedbackSummary"],
};

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCursor(value: unknown): Date | undefined {
  const cursor = pickString(value);
  if (!cursor) return undefined;
  const date = new Date(cursor);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseFieldGroups(value: unknown): ObservationFieldGroup[] {
  const groups = pickString(value)?.split(",").map((part) => part.trim()) || ["core", "basic", "usage"];
  return groups.filter((group): group is ObservationFieldGroup => group in fieldGroups);
}

function buildProjection(fields: unknown): ProjectionType<IAiTraceSpan> {
  const selected = new Set<string>(["_id"]);
  for (const group of parseFieldGroups(fields)) {
    for (const field of fieldGroups[group]) selected.add(field);
  }
  return Array.from(selected).join(" ");
}

function addRange(match: ObservationMatch, field: "durationMs" | "cost", min: unknown, max: unknown) {
  const range: Record<string, number> = {};
  const minValue = pickNumber(min);
  const maxValue = pickNumber(max);
  if (minValue !== undefined) range.$gte = minValue;
  if (maxValue !== undefined) range.$lte = maxValue;
  if (Object.keys(range).length > 0) {
    match[field] = range;
  }
}

function buildMatch(scope: AiScope, query: ObservationQuery): ObservationMatch {
  const match: ObservationMatch = buildScopeMatch(scope);
  const cursor = parseCursor(query.cursor);
  if (cursor) match.startedAt = { $lt: cursor };

  const exactFields: Array<[keyof ObservationQuery, string]> = [
    ["traceId", "traceId"],
    ["sessionId", "sessionId"],
    ["endUserId", "endUserId"],
    ["kind", "kind"],
    ["provider", "provider"],
    ["modelName", "modelName"],
    ["status", "status"],
    ["level", "level"],
    ["environment", "environment"],
    ["serviceName", "serviceName"],
    ["endpoint", "endpoint"],
    ["promptSlug", "promptSlug"],
    ["promptName", "promptName"],
    ["promptVersion", "promptVersion"],
    ["promptLabel", "promptLabel"],
    ["promptEnvironment", "promptEnvironment"],
    ["tag", "tags"],
  ];

  for (const [queryField, modelField] of exactFields) {
    const value = pickString(query[queryField]);
    if (value) match[modelField] = value;
  }

  addRange(match, "durationMs", query.minLatencyMs, query.maxLatencyMs);
  addRange(match, "cost", query.minCost, query.maxCost);
  return match;
}

export async function listObservations(scope: AiScope, query: ObservationQuery) {
  const limit = Math.min(Math.max(Math.trunc(pickNumber(query.limit) || 50), 1), 100);
  const observations = await AiTraceSpan.find(buildMatch(scope, query))
    .select(buildProjection(query.fields))
    .sort({ startedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const page = observations.slice(0, limit);
  const last = page[page.length - 1];
  return {
    observations: page,
    nextCursor: observations.length > limit && last?.startedAt ? last.startedAt.toISOString() : null,
  };
}
