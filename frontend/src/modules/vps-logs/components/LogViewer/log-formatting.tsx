"use client";

import { Badge } from "@/components/ui/badge";
import type { RecentLogRow } from "../../hooks/useVpsLogs";

export function stripAnsiCodes(text: string): string {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}

export function isPm2Noise(line: string): boolean {
  const stripped = stripAnsiCodes(line || "").replace(/^\d+\|[^|]+\s+\|/, "").trim();
  if (/\[PM2\]|Spawning PM2 daemon|PM2 Successfully daemonized|Tailing last 100 lines|last 100 lines:/i.test(stripped)) {
    return true;
  }
  if (/PM2\s+\||PM2 log:/i.test(line)) {
    return true;
  }
  if (/[\\\/_]{5,}/.test(stripped)) {
    return true;
  }
  if (/^[\\\/\s_|\-\/\\=]+$/.test(stripped) && (stripped.includes("/") || stripped.includes("\\"))) {
    return true;
  }
  return false;
}

export function renderFormattedLogEntry(row: RecentLogRow) {
  const cleanMsg = stripAnsiCodes(row.message || "").trim();

  if (row.source === "system" && row.service === "host-metrics") {
    try {
      const metrics = JSON.parse(cleanMsg);
      const cpu = metrics.cpuPercent ?? 0;
      const ramUsed = metrics.ramUsedMb ?? 0;
      const ramTotal = metrics.ramTotalMb ?? 0;
      const ramPercent = ramTotal > 0 ? (ramUsed / ramTotal) * 100 : 0;
      const disk = metrics.diskUsedPercent ?? 0;

      return (
        <div className="space-y-2.5 mt-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span className="font-semibold text-foreground">Host Performance Snapshot</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 rounded-lg p-3">
            <MetricBar label="CPU Usage" value={`${cpu.toFixed(1)}%`} percent={cpu} />
            <MetricBar label={`RAM (${ramUsed}MB / ${ramTotal}MB)`} value={`${ramPercent.toFixed(1)}%`} percent={ramPercent} />
            <MetricBar label="Disk Space" value={`${disk.toFixed(1)}%`} percent={disk} />
          </div>
        </div>
      );
    } catch {
      // fall through to plain log formatting
    }
  }

  const accessLogRegex = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3})\s+(\d+|-)/;
  const accessMatch = cleanMsg.match(accessLogRegex);
  if (accessMatch) {
    const clientIp = accessMatch[1];
    const requestString = accessMatch[3];
    const statusCode = parseInt(accessMatch[4], 10);
    const bytesVal = accessMatch[5];
    const bytes = bytesVal === "-" ? 0 : parseInt(bytesVal, 10);
    const sizeFormatted = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;

    const reqParts = requestString.split(" ");
    const firstWord = reqParts[0];
    const isStandardMethod = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)$/i.test(firstWord);
    const method = isStandardMethod ? firstWord.toUpperCase() : "RAW";
    let path = isStandardMethod ? reqParts.slice(1, -1).join(" ") || reqParts[1] || "" : requestString;
    if (!path) path = "/";

    const displayPath = path.length > 120 ? `${path.slice(0, 120)}...` : path;
    const methodClass = getMethodClass(method);
    const statusClass = getStatusClass(statusCode);

    return (
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`${methodClass} font-mono font-bold text-[10px] px-1.5 py-0.5 border`}>
            {method}
          </Badge>
          <span className="text-xs font-semibold text-foreground font-mono break-all">{displayPath}</span>
          <Badge variant="outline" className={`${statusClass} font-mono font-bold text-[10px] px-1.5 py-0.5 border`}>
            HTTP {statusCode}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground font-medium">
          <span>IP: <strong className="text-slate-600 dark:text-slate-400">{clientIp}</strong></span>
          <span>Payload Size: <strong className="text-slate-600 dark:text-slate-400">{sizeFormatted}</strong></span>
        </div>
      </div>
    );
  }

  let isErrorLog = false;
  let cleanDisplayMsg = cleanMsg;
  const nginxErrorRegex = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} \[[^\]]+\] \d+#\d+: \*\d+\s+/;
  if (nginxErrorRegex.test(cleanMsg)) {
    isErrorLog = true;
    cleanDisplayMsg = cleanMsg.replace(nginxErrorRegex, "");
  } else {
    const apacheErrorRegex = /^\[[^\]]+\] \[[^\]]+\] (\[pid \d+\] )?(\[client [^\]]+\] )?/;
    if (apacheErrorRegex.test(cleanMsg)) {
      isErrorLog = true;
      cleanDisplayMsg = cleanMsg.replace(apacheErrorRegex, "");
    }
  }

  if (!isErrorLog) {
    const generalTimestampRegex = /^\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?\s*[-:]?\s*/i;
    cleanDisplayMsg = cleanDisplayMsg.replace(generalTimestampRegex, "");
    const inlineTimestampRegex = /\s*(?:at\s+|@\s+)?\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?/gi;
    cleanDisplayMsg = cleanDisplayMsg.replace(inlineTimestampRegex, "");
  }

  if (isErrorLog) {
    return (
      <div className="mt-1">
        <p className="text-xs text-red-500 font-mono bg-red-500/5 border border-red-500/10 rounded px-2.5 py-1.5 whitespace-pre-wrap wrap-break-word">
          {cleanDisplayMsg}
        </p>
      </div>
    );
  }

  return <p className="text-xs text-foreground whitespace-pre-wrap wrap-break-word font-mono mt-1">{cleanDisplayMsg}</p>;
}

function MetricBar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span>{label}</span>
        <span className="text-slate-700 dark:text-slate-300">{value}</span>
      </div>
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percent > 85 ? "bg-red-500" : percent > 60 ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

function getMethodClass(method: string): string {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    POST: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    PUT: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
    PATCH: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    RAW: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  };
  return methodColors[method] || methodColors.RAW;
}

function getStatusClass(statusCode: number): string {
  if (statusCode >= 500) return "bg-red-500/15 text-red-500 border-red-500/30";
  if (statusCode >= 400) return "bg-amber-500/15 text-amber-500 border-amber-500/30";
  if (statusCode >= 300) return "bg-blue-500/15 text-blue-500 border-blue-500/30";
  return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
}
