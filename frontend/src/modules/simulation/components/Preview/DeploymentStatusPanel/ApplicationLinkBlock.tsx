"use client";

import { useState } from "react";
import { ExternalLink, Check, Copy } from "@/icons";
import { Badge } from "@/components/ui/badge";

export function ApplicationLinkBlock({
  label,
  url,
  port,
  containerPort,
  proxy,
  healthCommand,
  healthLogPath,
}: {
  label: string;
  url: string;
  port?: number;
  containerPort?: number;
  proxy?: string;
  healthCommand?: string;
  healthLogPath?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedHealth, setCopiedHealth] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHealth = () => {
    if (!healthCommand) return;
    navigator.clipboard.writeText(healthCommand);
    setCopiedHealth(true);
    setTimeout(() => setCopiedHealth(false), 2000);
  };

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-left space-y-3 select-text">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ExternalLink className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="truncate text-xs font-bold text-foreground">
            {label}
          </span>
        </div>
        {proxy && (
          <Badge
            variant="outline"
            className="shrink-0 border-emerald-500/20 bg-emerald-500/10 text-[9px] text-emerald-600"
          >
            {proxy}
            {port ? ` :${port}` : ""}
            {containerPort && containerPort !== port
              ? ` -> :${containerPort}`
              : ""}
          </Badge>
        )}
      </div>

      <div className="relative flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 font-mono text-[10px] text-slate-100 break-all pr-20">
        <span>{url}</span>
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            title="Copy application link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            title="Open application"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {healthCommand && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Runtime Diagnostics
            </span>
            {healthLogPath && (
              <span className="truncate font-mono text-[9px] text-muted-foreground">
                {healthLogPath}
              </span>
            )}
          </div>
          <div className="relative rounded-md bg-slate-950 border border-slate-800 px-3 py-2 pr-10 font-mono text-[10px] text-slate-100 break-all">
            <span>{healthCommand}</span>
            <button
              onClick={handleCopyHealth}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              title="Copy diagnostics command"
            >
              {copiedHealth ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
