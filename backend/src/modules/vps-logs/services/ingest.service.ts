import { createHash } from "crypto";
import { VpsLogAgent } from "../models/vps-log-agent.model";
import { VpsLogEntry, VpsLogLevel, VpsLogSource } from "../models/vps-log-entry.model";
import { VpsAlertPolicy } from "../models/vps-alert-policy.model";
import { sendVpsErrorBurstAlerts } from "./alert-notification.service";
import { evaluateVpsAlarmRules } from "./alert.service";
import { logger } from "../../../core/logger";
import { FEATURE_KEYS, getFeatureAccessForUser } from "../../admin";

interface IngestPayload {
  agentId: string;
  source: VpsLogSource;
  service?: string;
  logsBase64: string;
  timestamp?: string;
}

interface StoredVpsLogEntry {
  userId: string;
  agentId: string;
  source: VpsLogSource;
  service: string;
  level: VpsLogLevel;
  message: string;
  timestamp: string;
  errorSignature?: string;
}

const ERROR_ALERT_THRESHOLD = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_THRESHOLD || "25", 10));
const ERROR_ALERT_WINDOW_MINUTES = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_WINDOW_MINUTES || "15", 10));
const ERROR_ALERT_COOLDOWN_MINUTES = Math.max(1, parseInt(process.env.VPS_LOG_ERROR_ALERT_COOLDOWN_MINUTES || "60", 10));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function inferLevel(line: string): VpsLogLevel {
  const v = line.toLowerCase();
  if (/(error|exception|fatal|panic|traceback|uncaught)/.test(v)) return "error";
  if (/(warn|warning|deprecated)/.test(v)) return "warn";
  if (/(debug|verbose)/.test(v)) return "debug";
  return "info";
}

function buildErrorSignature(line: string): string | undefined {
  if (inferLevel(line) !== "error") return undefined;
  const compact = line
    .replace(/[0-9]{2,}/g, "#")
    .replace(/[a-f0-9]{8,}/gi, "<id>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180)
    .toLowerCase();
  return compact || undefined;
}

function decodeLines(base64Text: string): string[] {
  try {
    const decoded = Buffer.from(base64Text, "base64").toString("utf8");
    const rawLines = decoded
      .split(/\r?\n/)
      .map((line) => line.replace(/\r$/, ""))
      .filter(Boolean)
      .slice(-1200);

    const stripPm2Prefix = (line: string) => line.replace(/^\d+\|[^|]+\s+\|\s?/, "");

    const isPm2Noise = (line: string): boolean => {
      const stripped = stripPm2Prefix(line);
      if (
        /\[PM2\]|Spawning PM2 daemon|PM2 Successfully daemonized|Tailing last 100 lines|last 100 lines:/i.test(
          stripped
        )
      ) {
        return true;
      }
      if (/PM2\s+\||PM2 log:/i.test(line)) {
        return true;
      }
      if (/[\\\/_]{5,}/.test(stripped)) {
        return true;
      }
      if (
        /^[\\\/\s_|\-\/\\=]+$/.test(stripped) &&
        (stripped.includes("/") || stripped.includes("\\"))
      ) {
        return true;
      }
      return false;
    };

    const cleaned = rawLines
      .map((line) => stripPm2Prefix(line).trimEnd())
      .filter(Boolean)
      .filter((line) => !isPm2Noise(line));

    const countChar = (text: string, char: string) =>
      (text.match(new RegExp(`\\${char}`, "g")) || []).length;
    const looksLikeEntryStart = (line: string) =>
      /\[(ERROR|WARN|INFO|DEBUG)\]/i.test(line) ||
      /\b(ERROR|WARN|INFO|DEBUG|FATAL|EXCEPTION)\b/i.test(line) ||
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(line);

    const merged: string[] = [];
    let current = "";
    let braceDepth = 0;

    for (const line of cleaned) {
      const trimmed = line.trimStart();
      const opens = countChar(line, "{") + countChar(line, "[");
      const closes = countChar(line, "}") + countChar(line, "]");

      if (!current) {
        current = line;
        braceDepth = Math.max(0, opens - closes);
        continue;
      }

      const isContinuation =
        braceDepth > 0 ||
        (!looksLikeEntryStart(trimmed) &&
          (/^[\]}\),]/.test(trimmed) || /^"/.test(trimmed) || /^'/.test(trimmed)));

      if (isContinuation) {
        current += `\n${line}`;
        braceDepth = Math.max(0, braceDepth + opens - closes);
        continue;
      }

      merged.push(current);
      current = line;
      braceDepth = Math.max(0, opens - closes);
    }

    if (current) merged.push(current);

    return merged.slice(-200);
  } catch {
    return [];
  }
}

export async function ingestVpsLogs(
  payload: IngestPayload,
  suppliedAgentId?: string,
  suppliedKey?: string
) {
  const agentId = suppliedAgentId || payload.agentId;
  if (!agentId || !suppliedKey) {
    throw new Error("Missing ingest credentials");
  }

  const agent = await VpsLogAgent.findOne({ agentId });
  if (!agent) {
    throw new Error("Unknown agent");
  }

  const keyHash = sha256(suppliedKey);
  if (keyHash !== agent.ingestKeyHash) {
    throw new Error("Invalid ingest key");
  }

  const access = await getFeatureAccessForUser(agent.userId, FEATURE_KEYS.vpsLogs);
  if (!access.allowed) {
    const error = new Error(
      access.lockedDescription ||
        "Your current plan does not include VPS Logs ingestion.",
    ) as Error & { status?: number; code?: string };
    error.status = 403;
    error.code = "FEATURE_NOT_ENTITLED";
    throw error;
  }

  const lines = decodeLines(payload.logsBase64);
  if (!lines.length) {
    return { accepted: 0 };
  }

  const now = payload.timestamp ? new Date(payload.timestamp) : new Date();
  const service = payload.service || "unknown";
  const docs: StoredVpsLogEntry[] = lines.map((line) => ({
    userId: agent.userId,
    agentId,
    source: payload.source,
    service,
    level: inferLevel(line),
    message: line.slice(0, 3000),
    timestamp: now.toISOString(),
    errorSignature: buildErrorSignature(line),
  }));

  try {
    await VpsLogEntry.insertMany(
      docs.map((doc) => ({
        userId: doc.userId,
        agentId: doc.agentId,
        source: doc.source,
        service: doc.service,
        level: doc.level,
        message: doc.message,
        timestamp: new Date(doc.timestamp),
        errorSignature: doc.errorSignature,
        metadata: {
          userId: doc.userId,
          agentId: doc.agentId,
          source: doc.source,
          service: doc.service,
          level: doc.level,
          errorSignature: doc.errorSignature || "",
        },
      })),
      { ordered: false }
    );
  } catch (error) {
    logger.warn("[vps-logs] Mongo hot-store write failed", error);
  }
  await VpsLogAgent.updateOne({ _id: agent._id }, { $set: { lastSeenAt: new Date() } });

  let alertResults = [];
  try {
    alertResults = await sendVpsErrorBurstAlerts(agent, docs);
  } catch (error: any) {
    logger.warn("[vps-logs] Error burst alert failed", error);
    alertResults = [
      {
        signature: "unknown",
        count: 0,
        threshold: ERROR_ALERT_THRESHOLD,
        emailSent: false,
        skippedReason: "alert_check_failed",
        error: error?.message || "Unknown alert error",
      },
    ];
  }

  let alarmResults = [];
  try {
    alarmResults = await evaluateVpsAlarmRules(agent, docs);
  } catch (error: any) {
    logger.warn("[vps-logs] Custom alarm evaluation failed", error);
    alarmResults = [
      {
        ruleId: "unknown",
        name: "Unknown alarm",
        type: "log_volume",
        triggered: false,
        threshold: 0,
        emailSent: false,
        skippedReason: "alarm_check_failed",
        error: error?.message || "Unknown alarm error",
      },
    ];
  }

  const policy = (await VpsAlertPolicy.findOne({ userId: agent.userId }).lean()) || {
    errorSignatureThreshold: ERROR_ALERT_THRESHOLD,
    windowMinutes: ERROR_ALERT_WINDOW_MINUTES,
    cooldownMinutes: ERROR_ALERT_COOLDOWN_MINUTES,
  };

  return {
    accepted: docs.length,
    alertPolicy: {
      errorSignatureThreshold: policy.errorSignatureThreshold,
      windowMinutes: policy.windowMinutes,
      cooldownMinutes: policy.cooldownMinutes,
    },
    alertResults,
    alarmResults,
  };
}
