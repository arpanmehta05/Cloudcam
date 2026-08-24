"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Server, ShieldAlert, ShieldCheck, Zap } from "@/icons";

const statusTones: Record<string, { label: string }> = {
  draft: { label: "Draft" },
  preflight: { label: "Preflight" },
  snapshotting: { label: "Snapshotting" },
  launching_target: { label: "Launching Target" },
  validating: { label: "Validating" },
  awaiting_cutover: { label: "Awaiting Cutover" },
  cutover: { label: "Cutover Active" },
  completed: { label: "Completed" },
  failed: { label: "Failed" },
  rolled_back: { label: "Rolled Back" },
};

interface OverviewGridProps {
  progressPercent: number;
  completedTaskCount: number;
  activeTasksCount: number;
  runningTask: any;
  activeJobStatus: string;
  pendingTaskCount: number;
  targetHostLabel: string;
  targetHost: string | null;
  activeJobAccessMode: string;
  activeJobAccessConfigMethod?: string;
}

export function OverviewGrid({
  progressPercent,
  completedTaskCount,
  activeTasksCount,
  runningTask,
  activeJobStatus,
  pendingTaskCount,
  targetHostLabel,
  targetHost,
  activeJobAccessMode,
  activeJobAccessConfigMethod,
}: OverviewGridProps) {
  const overviewCards = [
    {
      label: "Execution progress",
      value: `${progressPercent}%`,
      detail: `${completedTaskCount}/${activeTasksCount} steps completed`,
      icon: <Activity className="h-4 w-4 text-blue-600 dark:text-blue-300" />,
      shell: "from-blue-600/15 via-blue-500/5 to-transparent border-blue-200/70 dark:border-blue-900/40",
    },
    {
      label: "Current focus",
      value: runningTask
        ? runningTask.title
        : statusTones[activeJobStatus]?.label || activeJobStatus,
      detail: runningTask
        ? "Live execution is still running."
        : pendingTaskCount > 0
        ? `${pendingTaskCount} steps still queued.`
        : "Workflow is waiting for the next operator action.",
      icon: <Zap className="h-4 w-4 text-violet-600 dark:text-violet-300" />,
      shell: "from-violet-600/15 via-violet-500/5 to-transparent border-violet-200/70 dark:border-violet-900/40",
    },
    {
      label: "Target endpoint",
      value: targetHostLabel,
      detail: targetHost
        ? "SSH command is ready to use."
        : "SSH command is shown with a target IP placeholder.",
      icon: <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />,
      shell: "from-emerald-600/15 via-emerald-500/5 to-transparent border-emerald-200/70 dark:border-emerald-900/40",
    },
    {
      label: "Trust boundary",
      value: activeJobAccessMode === "deep_inspection" ? "Deep inspection" : "Cloud-only",
      detail: activeJobAccessMode === "deep_inspection"
        ? `Internal checks via ${activeJobAccessConfigMethod || "configured access"}.`
        : "Cloud configuration is verified, app internals need manual confirmation.",
      icon: activeJobAccessMode === "deep_inspection" ? (
        <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
      ) : (
        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" />
      ),
      shell: activeJobAccessMode === "deep_inspection"
        ? "from-cyan-600/15 via-cyan-500/5 to-transparent border-cyan-200/70 dark:border-cyan-900/40"
        : "from-amber-600/15 via-amber-500/5 to-transparent border-amber-200/70 dark:border-amber-900/40",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {overviewCards.map((card, idx) => (
        <Card
          key={idx}
          className={`relative overflow-hidden border bg-gradient-to-br ${card.shell} bg-white/70 dark:bg-slate-900/40 shadow-sm transition-all hover:shadow-md duration-300`}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {card.label}
              </span>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 shadow-sm shrink-0">
                {card.icon}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white truncate font-mono">
                {card.value}
              </div>
              <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">
                {card.detail}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
