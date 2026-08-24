import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "@/icons";
import { SERVICE_REGISTRY } from "@/lib/services/registry";

interface LogEntryProps {
  log: any;
  idx: number;
}

export function LogEntry({ log, idx }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const msgLower = log.message?.toLowerCase() || "";
  const severity = log.severity || "INFO";
  const sevLower = severity.toLowerCase();
  
  const isError =
    msgLower.includes("error") ||
    msgLower.includes("exception") ||
    msgLower.includes("failed") ||
    sevLower.includes("err") ||
    sevLower.includes("fail") ||
    sevLower.includes("crit");
    
  const isWarn = (msgLower.includes("warn") || sevLower.includes("warn")) && !isError;

  let isJson = false;
  let parsedJson: any = null;
  let isRequestLog = false;

  try {
    const trimmed = (log.message || "").trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      parsedJson = JSON.parse(trimmed);
      isJson = true;
      if (parsedJson.method && parsedJson.resource) {
        isRequestLog = true;
      }
    }
  } catch (e) {
    // ignore
  }

  const getMethodBadge = (method: string) => {
    const m = method.toUpperCase();
    let colorClass = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/50";
    if (m === "GET") colorClass = "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200/30";
    else if (m === "POST") colorClass = "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-200/30";
    else if (m === "PUT" || m === "PATCH") colorClass = "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/30";
    else if (m === "DELETE") colorClass = "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/30";
    
    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider border", colorClass)}>
        {m}
      </span>
    );
  };

  const getStatusBadge = (status: number) => {
    let colorClass = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/50";
    if (status >= 200 && status < 300) colorClass = "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/30";
    else if (status >= 300 && status < 400) colorClass = "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/30";
    else if (status >= 400 && status < 500) colorClass = "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/30";
    else if (status >= 500) colorClass = "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-200/30";

    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-extrabold border", colorClass)}>
        STATUS {status}
      </span>
    );
  };

  const getSeverityBadge = () => {
    let colorClass = "bg-blue-50/70 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200/20";
    if (isError) colorClass = "bg-rose-50/70 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/20";
    else if (isWarn) colorClass = "bg-amber-50/70 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/20";
    
    return (
      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border tracking-wider", colorClass)}>
        {severity}
      </span>
    );
  };

  const provider = log.provider || "aws";
  const stream = log.logStream || log.resource || "system";
  let cleanStreamName = stream.split("/").pop() || stream;

  const registryConfig = SERVICE_REGISTRY[cleanStreamName.toLowerCase()];
  if (registryConfig) {
    if (provider === "azure") {
      cleanStreamName = registryConfig.azureDisplayName || registryConfig.displayName;
    } else if (provider === "gcp") {
      cleanStreamName = registryConfig.gcpDisplayName || registryConfig.displayName;
    } else {
      cleanStreamName = registryConfig.displayName;
    }
  }

  return (
    <>
      <tr
        className={cn(
          "group hover:bg-primary/[0.01] transition-colors border-l-2",
          isError || (isRequestLog && parsedJson.status >= 500)
            ? "border-l-destructive bg-destructive/[0.01]"
            : isWarn || (isRequestLog && parsedJson.status >= 400)
              ? "border-l-yellow-500 bg-yellow-500/[0.01]"
              : "border-l-transparent"
        )}
      >
        <td className="py-4 px-6 whitespace-nowrap text-muted-foreground/80 font-mono text-xs">
          {log.timestamp
            ? new Date(log.timestamp)
                .toISOString()
                .replace("T", " ")
                .substring(0, 19)
            : "—"}
        </td>
        <td className="py-4 px-6">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted/40 text-muted-foreground/90 border border-border/30 max-w-[160px] truncate" title={stream}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isError ? "bg-red-500" : isWarn ? "bg-yellow-500" : "bg-blue-500")} />
            {cleanStreamName}
          </span>
        </td>
        <td className="py-4 px-6">
          {isRequestLog ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {getMethodBadge(parsedJson.method)}
                <code className="text-xs font-mono font-bold text-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-border/30">
                  {parsedJson.resource}
                </code>
                {getStatusBadge(parsedJson.status)}
                {parsedJson.latency && (
                  <span className="inline-flex items-center text-[10px] font-extrabold text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded border border-border/10">
                    LATENCY: {parsedJson.latency}
                  </span>
                )}
                {parsedJson.ip && (
                  <span className="inline-flex items-center text-[10px] font-extrabold text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded border border-border/10">
                    IP: {parsedJson.ip}
                  </span>
                )}
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 bg-muted/70 hover:bg-muted rounded text-[10px] font-bold text-muted-foreground border border-border/30 transition"
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Details
                </button>
              </div>
              {parsedJson.userAgent && (
                <div className="text-[10px] text-muted-foreground/50 font-medium pl-1 flex items-center gap-1.5">
                  <span className="opacity-60">User Agent:</span>
                  <span className="truncate max-w-lg font-mono" title={parsedJson.userAgent}>{parsedJson.userAgent}</span>
                </div>
              )}
            </div>
          ) : isJson ? (
            <div className="flex items-center justify-between gap-3">
              <span className="truncate opacity-80 font-mono text-xs">
                {JSON.stringify(parsedJson)}
              </span>
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/70 hover:bg-muted rounded text-[10px] font-bold text-muted-foreground border border-border/30 transition shrink-0"
              >
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Expand
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {getSeverityBadge()}
              <span className={cn(
                "text-xs font-semibold leading-relaxed",
                isError ? "text-destructive font-bold" : isWarn ? "text-yellow-600 dark:text-yellow-400" : "text-foreground/95"
              )}>
                {log.message || "NO CONTENT IN STREAM"}
              </span>
            </div>
          )}
        </td>
      </tr>
      {expanded && isJson && (
        <tr className="bg-muted/10">
          <td colSpan={3} className="py-3 px-6 border-l-2 border-l-primary/20">
            <pre className="text-xs whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/60 p-4 rounded-lg border border-border/20 leading-relaxed font-mono max-h-[400px] overflow-y-auto">
              {JSON.stringify(parsedJson, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
