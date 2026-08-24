"use client";

import React from "react";
import { AlertCircle, Code } from "@/icons";
import { Badge } from "@/components/ui/badge";

interface TfConfigError {
  nodeId: string;
  nodeLabel: string;
  field: string;
  message: string;
}

interface ResourceDetailsListProps {
  validationErrors: TfConfigError[];
  result: {
    resourceCount: number;
    resources: Array<{ address: string; type: string; name: string; serviceId: string }>;
    implicitResources: Array<{ address: string; type: string; name: string; serviceId: string }>;
  } | null;
  nodeToResources: Array<{
    resource: { address: string; type: string; name: string; serviceId: string };
    nodeId: string;
    nodeLabel: string;
  }>;
  resourceIcons: Record<string, any>;
  resourceTypeLabels: Record<string, string>;
  serviceColors: Record<string, string>;
}

export function ResourceDetailsList({
  validationErrors,
  result,
  nodeToResources,
  resourceIcons,
  resourceTypeLabels,
  serviceColors,
}: ResourceDetailsListProps) {
  if (validationErrors.length > 0) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4.5">
        <div className="mb-3.5 flex items-center gap-2 text-sm font-bold text-red-400">
          <AlertCircle className="h-4.5 w-4.5" />
          Configuration Issues Detected
        </div>
        <div className="space-y-2">
          {validationErrors.map((err, i) => (
            <div key={i} className="rounded-lg border border-red-500/10 bg-red-500/10 px-3 py-2.5">
              <p className="text-xs font-extrabold text-red-300">{err.nodeLabel}</p>
              <p className="mt-1 text-xs text-red-400/80">
                <code className="rounded bg-red-500/15 px-1 py-0.5 font-mono text-[10px]">
                  {err.field}
                </code>
                : {err.message}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Resource Summary Metric Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/45 p-3.5 text-center transition hover:shadow-xs hover:border-primary/20 group">
          <p className="text-xl font-black text-foreground">{result.resourceCount}</p>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-0.5 font-sans">Total</p>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-300 dark:bg-zinc-700 transition-colors group-hover:bg-primary/50" />
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/45 p-3.5 text-center transition hover:shadow-xs hover:border-primary/20 group">
          <p className="text-xl font-black text-foreground">{result.resources.length}</p>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-0.5 font-sans">Explicit</p>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-300 dark:bg-zinc-700 transition-colors group-hover:bg-primary/50" />
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/45 p-3.5 text-center transition hover:shadow-xs hover:border-primary/20 group">
          <p className="text-xl font-black text-foreground">{result.implicitResources.length}</p>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-0.5 font-sans">Implicit</p>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-300 dark:bg-zinc-700 transition-colors group-hover:bg-primary/50" />
        </div>
      </div>

      {/* Explicit resources — mapped to nodes */}
      <div>
        <p className="mb-2.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground font-sans">Explicit Resources</p>
        <div className="space-y-2">
          {nodeToResources.map(({ resource, nodeLabel }) => {
            const Icon = resourceIcons[resource.serviceId] || Code;
            const color = serviceColors[resource.serviceId] || "text-zinc-400";
            return (
              <div
                key={resource.address}
                className="group flex items-center gap-3.5 rounded-xl border border-border/60 bg-card/45 p-3.5 transition hover:bg-card/75 hover:border-primary/20 min-w-0 w-full"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ${color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-foreground font-sans">
                    {resourceTypeLabels[resource.type] || resource.type}
                  </p>
                  <p className="truncate text-[10px] font-semibold text-muted-foreground mt-0.5 font-mono">
                    {resource.address}
                  </p>
                </div>
                {nodeLabel && (
                  <Badge variant="outline" className="text-[9px] font-bold shrink-0 max-w-[120px] truncate bg-muted/30">
                    {nodeLabel}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Implicit resources */}
      {result.implicitResources.length > 0 && (
        <div>
          <p className="mb-2.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground font-sans">Implicit Infrastructure</p>
          <div className="space-y-1.5">
            {result.implicitResources.map((r) => {
              const Icon = resourceIcons[r.serviceId] || Code;
              return (
                <div
                  key={r.address}
                  className="flex items-center gap-3 rounded-lg bg-muted/30 border border-border/30 px-3.5 py-2.5 min-w-0 w-full"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-foreground font-sans">
                      {resourceTypeLabels[r.type] || r.type}
                    </p>
                  </div>
                  <span className="text-[9px] font-semibold text-muted-foreground shrink-0 max-w-[160px] truncate font-mono">
                    {r.address}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
