import crypto from "crypto";
import { AppError } from "../../../core/errors";
import {
  AiSharedReport,
  type IAiSharedReport,
  type SharedReportType,
} from "../../../models/ai-shared-report.model";
import { recordAudit } from "./audit.service";
import type { FeedbackScope } from "./feedback.service";

const REPORT_TYPES: SharedReportType[] = ["overview", "cost", "trace", "evaluation", "custom"];

function badRequest(message: string): AppError {
  return new AppError({ code: "ERR_BAD_REQUEST", message, status: 400 });
}

function notFound(): AppError {
  return new AppError({ code: "ERR_NOT_FOUND", message: "Shared report not found", status: 404 });
}

function generateToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function pickReportType(value: unknown): SharedReportType {
  if (typeof value === "string" && REPORT_TYPES.includes(value as SharedReportType)) {
    return value as SharedReportType;
  }
  return "custom";
}

/** Pure: a report is viewable when it is neither revoked nor past expiry. */
export function isReportViewable(
  report: Pick<IAiSharedReport, "revoked" | "expiresAt">,
  now: number = Date.now(),
): boolean {
  if (report.revoked) return false;
  if (report.expiresAt && new Date(report.expiresAt).getTime() <= now) return false;
  return true;
}

export interface CreateReportInput {
  title?: unknown;
  description?: string | null;
  reportType?: unknown;
  snapshot?: Record<string, unknown>;
  expiresInDays?: number | null;
  actorId?: string;
}

export async function createSharedReport(scope: FeedbackScope, input: CreateReportInput) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) throw badRequest("title is required");
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86400000)
      : null;
  const report = await AiSharedReport.create({
    userId: scope.userId,
    tenantId: scope.tenantId || null,
    workspaceId: scope.workspaceId || null,
    token: generateToken(),
    title: title.slice(0, 200),
    description: input.description || null,
    reportType: pickReportType(input.reportType),
    snapshot: input.snapshot && typeof input.snapshot === "object" ? input.snapshot : {},
    expiresAt,
    revoked: false,
    createdBy: input.actorId || scope.userId,
  });
  await recordAudit(scope, {
    actorId: input.actorId || scope.userId,
    action: "report.share",
    resourceType: "report",
    resourceId: String(report._id),
    resourceName: title,
    metadata: { reportType: report.reportType, expiresAt },
  });
  return { report };
}

export async function listSharedReports(scope: FeedbackScope) {
  const reports = await AiSharedReport.find({
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
  })
    .sort({ createdAt: -1 })
    .lean();
  return { reports };
}

export async function revokeSharedReport(scope: FeedbackScope, id: string, actorId?: string) {
  const report = await AiSharedReport.findOne({
    _id: id,
    userId: scope.userId,
    workspaceId: scope.workspaceId || null,
  });
  if (!report) throw notFound();
  report.revoked = true;
  await report.save();
  await recordAudit(scope, {
    actorId: actorId || scope.userId,
    action: "report.revoke",
    resourceType: "report",
    resourceId: id,
    resourceName: report.title,
  });
  return { report };
}

/**
 * Public, unauthenticated read by token. Returns only presentation-safe fields
 * (never the owning userId or internal ids beyond the snapshot).
 */
export async function getPublicReport(token: string) {
  const report = await AiSharedReport.findOne({ token });
  if (!report || !isReportViewable(report)) throw notFound();
  report.viewCount += 1;
  report.lastViewedAt = new Date();
  await report.save();
  return {
    report: {
      title: report.title,
      description: report.description,
      reportType: report.reportType,
      snapshot: report.snapshot,
      createdAt: report.createdAt,
    },
  };
}
