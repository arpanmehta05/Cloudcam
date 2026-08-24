import { VpsLogAgent } from "../models/vps-log-agent.model";
import { VpsLogEntry, VpsLogLevel, VpsLogSource } from "../models/vps-log-entry.model";
import { VpsAlertPolicy } from "../models/vps-alert-policy.model";
import { pruneRecentLogsFromS3, safeReadEntriesFromS3, StoredVpsLogEntry } from "./s3-archive.service";
import { logger } from "../../../core/logger";

interface VpsLogQueryFilters {
  start: Date;
  end?: Date;
  agentId?: string;
  source?: VpsLogSource;
  level?: VpsLogLevel;
  service?: string;
  q?: string;
}

const ERROR_ALERT_THRESHOLD = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_THRESHOLD || "25", 10));
const ERROR_ALERT_WINDOW_MINUTES = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_WINDOW_MINUTES || "15", 10));
const ERROR_ALERT_COOLDOWN_MINUTES = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_COOLDOWN_MINUTES || "60", 10));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupeLogEntries(entries: StoredVpsLogEntry[]): StoredVpsLogEntry[] {
  const seen = new Set<string>();
  const deduped: StoredVpsLogEntry[] = [];

  for (const entry of entries) {
    const fingerprint = [
      entry.userId,
      entry.agentId,
      entry.source,
      entry.service,
      entry.level,
      entry.timestamp,
      entry.errorSignature || "",
      entry.message,
    ].join("\u0001");
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    deduped.push(entry);
  }

  return deduped;
}

async function readEntriesFromMongo(
  userId: string,
  params: VpsLogQueryFilters
): Promise<StoredVpsLogEntry[]> {
  const { start, end, agentId, source, level, service, q } = params;
  const query: any = {
    userId,
    timestamp: {
      $gte: start,
      ...(end ? { $lt: end } : {}),
    },
  };
  if (agentId) query.agentId = agentId;
  if (source) query.source = source;
  if (level) query.level = level;
  if (service) query.service = service;
  if (q) {
    query.$or = [
      { message: { $regex: escapeRegExp(q), $options: "i" } },
      { service: { $regex: escapeRegExp(q), $options: "i" } },
    ];
  }

  const docs = await VpsLogEntry.find(query)
    .sort({ timestamp: -1 })
    .limit(12000)
    .lean();

  return docs.map((doc) => ({
    userId: doc.userId,
    agentId: doc.agentId,
    source: doc.source as VpsLogSource,
    service: doc.service,
    level: doc.level as VpsLogLevel,
    message: doc.message,
    timestamp: new Date(doc.timestamp).toISOString(),
    errorSignature: doc.errorSignature,
  }));
}

function buildSummaryFromEntries(entries: StoredVpsLogEntry[], hours: number) {
  const totalLogs = entries.length;

  const levels: Record<string, number> = { error: 0, warn: 0, info: 0, debug: 0 };
  const serviceMap = new Map<string, number>();
  const timelineMap = new Map<
    string,
    { hour: string; error: number; warn: number; info: number; debug: number }
  >();
  const errorMap = new Map<
    string,
    { signature: string; count: number; sample: string; service: string; lastSeenAt: string }
  >();

  for (const entry of entries) {
    levels[entry.level] = (levels[entry.level] || 0) + 1;
    serviceMap.set(entry.service || "unknown", (serviceMap.get(entry.service || "unknown") || 0) + 1);

    const hour = `${entry.timestamp.slice(0, 13)}:00:00Z`;
    if (!timelineMap.has(hour)) {
      timelineMap.set(hour, { hour, error: 0, warn: 0, info: 0, debug: 0 });
    }
    const bucket = timelineMap.get(hour)!;
    bucket[entry.level as VpsLogLevel] = (bucket[entry.level as VpsLogLevel] || 0) + 1;

    if (entry.level === "error" && entry.errorSignature) {
      const current = errorMap.get(entry.errorSignature);
      if (!current) {
        errorMap.set(entry.errorSignature, {
          signature: entry.errorSignature,
          count: 1,
          sample: entry.message,
          service: entry.service,
          lastSeenAt: entry.timestamp,
        });
      } else {
        current.count += 1;
        if (new Date(entry.timestamp).getTime() >= new Date(current.lastSeenAt).getTime()) {
          current.lastSeenAt = entry.timestamp;
          current.sample = entry.message;
          current.service = entry.service;
        }
      }
    }
  }

  const serviceBuckets = Array.from(serviceMap.entries())
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topErrors = Array.from(errorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recent = [...entries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 80)
    .map((row, idx) => ({
      id: `${row.agentId}-${new Date(row.timestamp).getTime()}-${idx}`,
      agentId: row.agentId,
      source: row.source,
      service: row.service,
      level: row.level,
      message: row.message,
      timestamp: row.timestamp,
    }));

  const normalizedNow = new Date();
  normalizedNow.setUTCMinutes(0, 0, 0);
  const bucketCount = Math.max(1, hours);
  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const bucketDate = new Date(normalizedNow.getTime() - i * 60 * 60 * 1000);
    const hour = `${bucketDate.toISOString().slice(0, 13)}:00:00Z`;
    if (!timelineMap.has(hour)) {
      timelineMap.set(hour, { hour, error: 0, warn: 0, info: 0, debug: 0 });
    }
  }

  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));

  return {
    success: true,
    windowHours: hours,
    alertPolicy: {
      errorSignatureThreshold: ERROR_ALERT_THRESHOLD,
      windowMinutes: ERROR_ALERT_WINDOW_MINUTES,
      cooldownMinutes: ERROR_ALERT_COOLDOWN_MINUTES,
    },
    totals: {
      logs: totalLogs,
      errors: levels.error || 0,
      warnings: levels.warn || 0,
    },
    levels,
    services: serviceBuckets,
    topErrors,
    timeline,
    recent,
  };
}

export async function clearRecentVpsLogs(
  userId: string,
  params?: { hours?: number; agentId?: string; source?: VpsLogSource }
) {
  const hours = Math.max(1, Math.min(params?.hours || 24, 24 * 14));
  const start = new Date(Date.now() - hours * 60 * 60 * 1000);
  const agentId = params?.agentId;
  const source = params?.source;

  if (agentId) {
    const agent = await VpsLogAgent.findOne({ userId, agentId }).lean();
    if (!agent) {
      throw new Error("Agent not found");
    }
  }

  const mongoQuery: any = {
    userId,
    timestamp: { $gte: start },
  };
  if (agentId) mongoQuery.agentId = agentId;
  if (source) mongoQuery.source = source;

  const mongoResult = await VpsLogEntry.deleteMany(mongoQuery);
  const s3Result = await pruneRecentLogsFromS3(userId, { start, agentId, source });

  return {
    cleared: true,
    windowHours: hours,
    mongoDeleted: mongoResult.deletedCount || 0,
    ...s3Result,
  };
}

export async function getVpsLogSummary(
  userId: string,
  params?: {
    hours?: number;
    start?: string;
    end?: string;
    agentId?: string;
    source?: VpsLogSource;
    level?: VpsLogLevel;
    service?: string;
    q?: string;
  }
) {
  const now = new Date();
  let start: Date;
  let end: Date | undefined;

  if (params?.start) {
    start = new Date(params.start);
    if (params.end) {
      end = new Date(params.end);
    }
  } else {
    const hours = Math.max(1, Math.min(params?.hours || 24, 24 * 14));
    start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  }

  const windowHours = end
    ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60))
    : Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60));

  const effectiveEnd = end || now;
  const filters: VpsLogQueryFilters = {
    start,
    end: effectiveEnd,
    agentId: params?.agentId,
    source: params?.source,
    level: params?.level,
    service: params?.service,
    q: params?.q?.trim() || undefined,
  };

  const [coldEntries, hotEntries] = await Promise.all([
    safeReadEntriesFromS3(userId, {
      ...filters,
      end: effectiveEnd,
    }),
    readEntriesFromMongo(userId, {
      ...filters,
      end: effectiveEnd,
    }),
  ]);

  const entries = dedupeLogEntries([...coldEntries, ...hotEntries]);
  const summary = buildSummaryFromEntries(entries, windowHours);

  const policy = (await VpsAlertPolicy.findOne({ userId }).lean()) || {
    errorSignatureThreshold: ERROR_ALERT_THRESHOLD,
    windowMinutes: ERROR_ALERT_WINDOW_MINUTES,
    cooldownMinutes: ERROR_ALERT_COOLDOWN_MINUTES,
  };

  summary.alertPolicy = {
    errorSignatureThreshold: policy.errorSignatureThreshold,
    windowMinutes: policy.windowMinutes,
    cooldownMinutes: policy.cooldownMinutes,
  };

  return summary;
}

export async function getVpsErrorOptimizationContext(
  userId: string,
  hours = 24
): Promise<string> {
  const summary = await getVpsLogSummary(userId, { hours });
  const top = summary.topErrors.slice(0, 5);
  if (!top.length) {
    return "No VPS error logs were ingested in the selected time window.";
  }

  const lines = top.map(
    (item, idx) =>
      `${idx + 1}. service=${item.service}, count=${item.count}, signature=${
        item.signature
      }, sample="${item.sample}"`
  );
  return [
    `VPS Log Error Summary (${hours}h): total_errors=${summary.totals.errors}, total_warnings=${summary.totals.warnings}`,
    ...lines,
  ].join("\n");
}
