import { AiAuditLog, type AuditResourceType } from "../../../models/ai-audit-log.model";

export interface AuditScope {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
}

export interface AuditEvent {
  actorId: string;
  action: string;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  resourceName?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

const SENSITIVE_KEYS = /token|secret|apikey|api_key|password|authorization|keyhash/i;

/** Strip obviously sensitive values from audit metadata before persistence. */
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object") return null;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.test(key)) {
      result[key] = "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Record an audit event. Never throws — auditing must not break the action. */
export async function recordAudit(scope: AuditScope, event: AuditEvent): Promise<void> {
  try {
    await AiAuditLog.create({
      userId: scope.userId,
      tenantId: scope.tenantId || null,
      workspaceId: scope.workspaceId || null,
      actorId: event.actorId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId || null,
      resourceName: event.resourceName || null,
      metadata: sanitizeAuditMetadata(event.metadata),
      ip: event.ip || null,
    });
  } catch (error) {
    console.error("[audit] failed to record audit event:", error);
  }
}

export interface AuditFilters {
  resourceType?: AuditResourceType;
  action?: string;
  resourceId?: string;
  page?: number;
  limit?: number;
}

export async function listAuditLogs(scope: AuditScope, filters: AuditFilters) {
  const limit = Math.min(Math.max(filters.limit || 50, 1), 200);
  const page = Math.max(filters.page || 1, 1);
  const match: Record<string, unknown> = { userId: scope.userId };
  if (scope.workspaceId) match.workspaceId = scope.workspaceId;
  if (filters.resourceType) match.resourceType = filters.resourceType;
  if (filters.action) match.action = filters.action;
  if (filters.resourceId) match.resourceId = filters.resourceId;

  const [logs, total] = await Promise.all([
    AiAuditLog.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AiAuditLog.countDocuments(match),
  ]);
  return { logs, total, page, limit, pages: Math.ceil(total / limit) };
}
