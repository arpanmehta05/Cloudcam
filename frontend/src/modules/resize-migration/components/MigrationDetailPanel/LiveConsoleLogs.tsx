"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "@/icons";

interface LiveConsoleLogsProps {
  selectedLogLevel: "all" | "info" | "warning" | "error";
  setSelectedLogLevel: (level: "all" | "info" | "warning" | "error") => void;
  filteredTerminalLogs: Array<{
    timestamp: string;
    scope: string;
    level: "info" | "warning" | "error";
    message: string;
  }>;
  handleCopyText: (text: string) => void;
  terminalScrollRef: React.RefObject<HTMLDivElement | null>;
}

export function LiveConsoleLogs({
  selectedLogLevel,
  setSelectedLogLevel,
  filteredTerminalLogs,
  handleCopyText,
  terminalScrollRef,
}: LiveConsoleLogsProps) {
  return (
    <Card className="border-[#e8eaee] bg-white shadow-sm dark:border-[#1E293B] dark:bg-[#0A1220] overflow-hidden select-text">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-md font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Console Logs
          </CardTitle>
          <CardDescription className="text-[11px] font-semibold text-slate-500">
            Real-time events streaming from CloudWatcher engine.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-900/50">
            {(["all", "info", "warning", "error"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLogLevel(lvl)}
                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase transition-all cursor-pointer ${
                  selectedLogLevel === lvl
                    ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[10px] font-extrabold border-slate-200"
            onClick={() => {
              const logText = filteredTerminalLogs
                .map(
                  (l) =>
                    `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.scope.toUpperCase()}] [${l.level.toUpperCase()}] ${l.message}`
                )
                .join("\n");
              handleCopyText(logText);
            }}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy Logs
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={terminalScrollRef}
          className="bg-slate-950 p-4 font-mono text-xs overflow-auto max-h-[520px] min-h-[320px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-955 flex flex-col"
        >
          <div className="space-y-1.5 flex-1">
            {filteredTerminalLogs.length > 0 ? (
              filteredTerminalLogs.map((log, idx) => {
                let textClass = "text-slate-300";
                if (log.level === "error") textClass = "text-red-400 font-semibold";
                else if (log.level === "warning") textClass = "text-amber-400 font-semibold";

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2 py-0.5 leading-relaxed hover:bg-slate-900/50 rounded px-1 -mx-1"
                  >
                    <span className="text-slate-500 shrink-0 select-none">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="text-blue-400 font-semibold shrink-0 select-none uppercase tracking-wide text-[10px]">
                      [{log.scope}]
                    </span>
                    <span className={textClass}>{log.message}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-500 italic text-center py-8">
                No logs recorded for this view.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
