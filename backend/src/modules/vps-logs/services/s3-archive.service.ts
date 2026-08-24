import { VpsLogEntry } from "../models/vps-log-entry.model";
import { logger } from "../../../core/logger";
import {
  VPS_LOG_S3_BUCKET,
  assertS3BucketConfigured,
  buildS3LogChunkKey,
  putObjectText,
  parseS3LogKey,
  getObjectText,
  listUserLogKeysFromS3,
  deleteS3Keys,
} from "../providers/s3.provider";

export interface StoredVpsLogEntry {
  userId: string;
  agentId: string;
  source: string;
  service: string;
  level: string;
  message: string;
  timestamp: string;
  errorSignature?: string;
}

export interface VpsLogQueryFilters {
  start: Date;
  end?: Date;
  agentId?: string;
  source?: string;
  level?: string;
  service?: string;
  q?: string;
}

const VPS_LOG_ARCHIVE_BATCH_LIMIT = Math.max(
  100,
  parseInt(process.env.VPS_LOG_ARCHIVE_BATCH_LIMIT || "5000", 10)
);

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function entryMatchesFilters(
  entry: StoredVpsLogEntry,
  filters: Pick<VpsLogQueryFilters, "source" | "level" | "service" | "q">
): boolean {
  if (filters.source && entry.source !== filters.source) return false;
  if (filters.level && entry.level !== filters.level) return false;
  if (filters.service && entry.service !== filters.service) return false;
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    const haystack = `${entry.message} ${entry.service} ${entry.source} ${entry.level}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export async function appendEntriesToS3(
  userId: string,
  agentId: string,
  entries: StoredVpsLogEntry[]
) {
  try {
    assertS3BucketConfigured();
    const byDay = new Map<string, StoredVpsLogEntry[]>();
    for (const entry of entries) {
      const day = toDayKey(new Date(entry.timestamp));
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(entry);
    }

    for (const [day, dayEntries] of byDay) {
      const key = buildS3LogChunkKey(userId, agentId, day);
      const addition = `${dayEntries
        .map((entry) => JSON.stringify(entry))
        .join("\n")}\n`;
      await putObjectText(key, addition);
    }
  } catch (e: any) {
    if (
      e.name === "NoSuchBucket" ||
      e.Code === "NoSuchBucket" ||
      (e.message &&
        (e.message.includes("bucket does not exist") ||
          e.message.includes("not configured")))
    ) {
      logger.warn(
        `S3 bucket ${
          VPS_LOG_S3_BUCKET || "not configured"
        } not found, skipping log append for agent ${agentId}`
      );
      return;
    }
    throw e;
  }
}

export async function archiveVpsLogsToS3(): Promise<{
  archived: number;
  objectsUploaded: number;
  skippedReason?: string;
}> {
  try {
    if (!VPS_LOG_S3_BUCKET) {
      return {
        archived: 0,
        objectsUploaded: 0,
        skippedReason: "s3_bucket_not_configured",
      };
    }

    const docs = await VpsLogEntry.find({
      archivedToS3At: { $exists: false },
    })
      .sort({ timestamp: 1 })
      .limit(VPS_LOG_ARCHIVE_BATCH_LIMIT)
      .lean();

    if (!docs.length) {
      return { archived: 0, objectsUploaded: 0 };
    }

    const byBatch = new Map<string, StoredVpsLogEntry[]>();

    for (const doc of docs) {
      const entry: StoredVpsLogEntry = {
        userId: doc.userId,
        agentId: doc.agentId,
        source: doc.source,
        service: doc.service,
        level: doc.level,
        message: doc.message,
        timestamp: new Date(doc.timestamp).toISOString(),
        errorSignature: doc.errorSignature,
      };
      const day = toDayKey(new Date(doc.timestamp));
      const batchId = `${doc.userId}\u0000${doc.agentId}\u0000${day}`;
      if (!byBatch.has(batchId)) byBatch.set(batchId, []);
      byBatch.get(batchId)!.push(entry);
    }

    let archived = 0;
    let objectsUploaded = 0;

    for (const entries of byBatch.values()) {
      const first = entries[0];
      if (!first) continue;

      const key = buildS3LogChunkKey(
        first.userId,
        first.agentId,
        toDayKey(new Date(first.timestamp))
      );
      await putObjectText(
        key,
        `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`
      );
      objectsUploaded += 1;

      const timestamps = entries.map((entry) => new Date(entry.timestamp));
      await VpsLogEntry.updateMany(
        {
          userId: first.userId,
          agentId: first.agentId,
          timestamp: { $in: timestamps },
          archivedToS3At: { $exists: false },
        },
        {
          $set: {
            archivedToS3At: new Date(),
            archiveBatchKey: key,
          },
        }
      );
      archived += entries.length;
    }

    return { archived, objectsUploaded };
  } catch (error: any) {
    if (
      error?.name === "NoSuchBucket" ||
      error?.Code === "NoSuchBucket" ||
      /bucket does not exist|not configured/i.test(error?.message || "")
    ) {
      logger.warn(
        `[vps-logs] S3 bucket ${
          VPS_LOG_S3_BUCKET || "not configured"
        } not found; archive job skipped`
      );
      return {
        archived: 0,
        objectsUploaded: 0,
        skippedReason: "s3_bucket_not_found",
      };
    }
    throw error;
  }
}

export async function readEntriesFromS3(
  userId: string,
  params: VpsLogQueryFilters
): Promise<StoredVpsLogEntry[]> {
  const { start, end, agentId } = params;
  const keys = await listUserLogKeysFromS3(userId, agentId);
  const entries: StoredVpsLogEntry[] = [];

  const relevantKeys = keys.filter((key) => {
    const parsedKey = parseS3LogKey(key, userId);
    if (!parsedKey) return false;

    const keyAgentId = parsedKey.agentId;
    if (agentId && keyAgentId !== agentId) return false;

    const dayStart = new Date(`${parsedKey.dayKey}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    if (dayEnd <= start) return false;
    if (end && dayStart >= end) return false;
    return true;
  });

  for (const key of relevantKeys) {
    const text = await getObjectText(key);
    if (!text) continue;
    const rows = text.split(/\r?\n/).filter(Boolean);
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row) as StoredVpsLogEntry;
        const ts = new Date(parsed.timestamp);
        if (Number.isNaN(ts.getTime())) continue;
        if (ts < start) continue;
        if (end && ts >= end) continue;
        if (!entryMatchesFilters(parsed, params)) continue;
        entries.push(parsed);
      } catch {
        continue;
      }
    }
  }

  return entries;
}

export async function safeReadEntriesFromS3(
  userId: string,
  params: VpsLogQueryFilters
): Promise<StoredVpsLogEntry[]> {
  try {
    return await readEntriesFromS3(userId, params);
  } catch (error: any) {
    logger.warn(
      "[vps-logs] S3 cold-store read failed; returning hot-store data only",
      error?.message || error
    );
    return [];
  }
}

export async function deleteAgentLogsFromS3(
  userId: string,
  agentId: string
): Promise<number> {
  try {
    assertS3BucketConfigured();
    const keys = await listUserLogKeysFromS3(userId, agentId);
    return await deleteS3Keys(keys);
  } catch (e: any) {
    if (
      e.name === "NoSuchBucket" ||
      e.Code === "NoSuchBucket" ||
      (e.message &&
        (e.message.includes("bucket does not exist") ||
          e.message.includes("not configured")))
    ) {
      logger.warn(
        `S3 bucket ${
          VPS_LOG_S3_BUCKET || "not configured"
        } not found, skipping log deletion for agent ${agentId}`
      );
      return 0;
    }
    throw e;
  }
}

export async function pruneRecentLogsFromS3(
  userId: string,
  params: { start: Date; agentId?: string; source?: string }
): Promise<{
  s3ObjectsDeleted: number;
  s3ObjectsRewritten: number;
  s3EntriesDeleted: number;
}> {
  assertS3BucketConfigured();
  const keys = await listUserLogKeysFromS3(userId, params.agentId);
  const keysToDelete: string[] = [];
  let s3ObjectsRewritten = 0;
  let s3EntriesDeleted = 0;

  for (const key of keys) {
    const parsedKey = parseS3LogKey(key, userId);
    if (!parsedKey) continue;
    if (params.agentId && parsedKey.agentId !== params.agentId) continue;

    const dayStart = new Date(`${parsedKey.dayKey}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    if (dayEnd <= params.start) continue;

    const text = await getObjectText(key);
    if (!text) continue;

    const keepRows: string[] = [];
    let removedFromObject = 0;

    for (const row of text.split(/\r?\n/).filter(Boolean)) {
      try {
        const entry = JSON.parse(row) as StoredVpsLogEntry;
        const ts = new Date(entry.timestamp);
        const shouldDelete =
          entry.userId === userId &&
          ts >= params.start &&
          (!params.agentId || entry.agentId === params.agentId) &&
          (!params.source || entry.source === params.source);

        if (shouldDelete) {
          removedFromObject += 1;
          continue;
        }
      } catch {
        // Keep malformed rows rather than risk deleting data we cannot classify.
      }

      keepRows.push(row);
    }

    if (!removedFromObject) continue;

    s3EntriesDeleted += removedFromObject;
    if (!keepRows.length) {
      keysToDelete.push(key);
    } else {
      await putObjectText(key, `${keepRows.join("\n")}\n`);
      s3ObjectsRewritten += 1;
    }
  }

  const s3ObjectsDeleted = await deleteS3Keys(keysToDelete);
  return { s3ObjectsDeleted, s3ObjectsRewritten, s3EntriesDeleted };
}
