import { AdminAuditLog } from "../../models/admin-audit-log.model";
import { logger } from "../../core/logger";

export interface AuditActor {
  userId: string;
  email?: string | null;
  ip?: string | null;
}

export interface AuditEntryInput {
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an admin action to the immutable audit log. Never throws — an audit
 * failure must not break the underlying admin operation.
 */
export async function writeAudit(
  actor: AuditActor,
  entry: AuditEntryInput,
): Promise<void> {
  try {
    await AdminAuditLog.create({
      actorId: actor.userId,
      actorEmail: actor.email ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
      ip: actor.ip ?? null,
    });
  } catch (err) {
    logger.error(`Failed to write admin audit log (${entry.action}): ${err}`);
  }
}

export async function listAudit(limit = 100) {
  return AdminAuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
}
