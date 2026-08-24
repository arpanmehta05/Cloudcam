"use client";

import { RefObject } from "react";

interface DeploymentLogsProps {
  logs: string[];
  logEndRef: RefObject<HTMLDivElement | null>;
  copied: boolean;
  onCopyLogs: () => void;
}

const formatLogLine = (line: string) => {
  const lower = line.toLowerCase();
  if (
    line.startsWith("[step]") ||
    lower.includes("terraform init") ||
    lower.includes("terraform apply") ||
    lower.includes("terraform plan")
  ) {
    return <span className="text-cyan-400 font-semibold">{line}</span>;
  }
  if (
    lower.includes("error:") ||
    lower.includes("failed") ||
    lower.includes("error ") ||
    lower.includes("failed to")
  ) {
    return <span className="text-rose-400 font-medium">{line}</span>;
  }
  if (
    lower.includes("success") ||
    lower.includes("complete!") ||
    lower.includes("created") ||
    lower.includes("creation complete")
  ) {
    return <span className="text-emerald-400 font-semibold">{line}</span>;
  }
  if (lower.includes("warning:") || lower.includes("warn")) {
    return <span className="text-amber-400 font-medium">{line}</span>;
  }
  if (line.startsWith("+") || line.startsWith(" +")) {
    return <span className="text-emerald-500">{line}</span>;
  }
  if (line.startsWith("-") || line.startsWith(" -")) {
    return <span className="text-rose-500">{line}</span>;
  }
  if (line.startsWith("~") || line.startsWith(" ~")) {
    return <span className="text-yellow-500">{line}</span>;
  }
  return <span className="text-zinc-300">{line}</span>;
};

export function DeploymentLogs({
  logs,
  logEndRef,
  copied,
  onCopyLogs,
}: DeploymentLogsProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0B0F19] shadow-2xl flex flex-col">
      {/* Terminal Header */}
      <div className="flex items-center justify-between bg-[#151D30] px-4 py-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
          <span className="text-[10px] text-slate-400 font-mono ml-2">
            deployment-runner.sh
          </span>
        </div>
        <button
          onClick={onCopyLogs}
          className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 border border-slate-700 hover:border-slate-500 px-2 py-0.5 rounded transition shrink-0"
        >
          {copied ? "Copied!" : "Copy Logs"}
        </button>
      </div>
      {/* Terminal Body */}
      <div className="h-80 overflow-y-auto p-4 font-mono text-[11px] space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-800">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <span className="animate-pulse">
              Waiting for runner initialization...
            </span>
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className="flex gap-3 items-start whitespace-pre-wrap break-all leading-relaxed"
            >
              <span className="text-slate-600 select-none text-right w-6 shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                {formatLogLine(log)}
              </div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
