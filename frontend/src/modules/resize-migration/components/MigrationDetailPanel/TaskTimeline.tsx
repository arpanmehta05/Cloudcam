"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Clock, Loader2, Check, X, ChevronUp, ChevronDown, AlertTriangle, Sparkles } from "@/icons";
import type { MigrationTask } from "../../types";

interface TaskTimelineProps {
  activeTasks: MigrationTask[];
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
  explainingTasks: Record<string, boolean>;
  handleExplainTask: (key: string) => void;
}

export function TaskTimeline({
  activeTasks,
  expandedTaskId,
  setExpandedTaskId,
  explainingTasks,
  handleExplainTask,
}: TaskTimelineProps) {
  return (
    <Card className="border-[#e8eaee] bg-white shadow-sm dark:border-[#1E293B] dark:bg-[#0A1220]">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
        <CardTitle className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" /> Migration Timeline
        </CardTitle>
        <CardDescription className="text-xs font-semibold text-slate-500">
          Track the execution and results of each migration step.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 max-h-[560px] overflow-auto select-text">
        <ol className="relative border-l border-slate-200 dark:border-slate-800 space-y-4 ml-3">
          {activeTasks.map((task) => {
            const isExpanded = expandedTaskId === task.key;
            const hasFailed = task.status === "failed";
            const isRunning = task.status === "running" || task.status === "retrying";
            const hasSucceeded = task.status === "succeeded";

            let iconBg = "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500";
            let icon = <Clock className="h-3 w-3" />;
            if (isRunning) {
              iconBg = "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
              icon = <Loader2 className="h-3 w-3 animate-spin" />;
            } else if (hasSucceeded) {
              iconBg = "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400";
              icon = <Check className="h-3 w-3" />;
            } else if (hasFailed) {
              iconBg = "bg-red-100 text-red-600 dark:bg-red-955/30 dark:text-red-400";
              icon = <X className="h-3 w-3" />;
            }

            return (
              <li key={task._id} className="relative pl-6">
                {/* Timeline Icon */}
                <span
                  className={`absolute -left-3.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white dark:border-[#0A1220] shadow-sm ${iconBg}`}
                >
                  {icon}
                </span>

                {/* Task Info */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.key)}
                      className="font-extrabold text-[14px] text-slate-800 dark:text-white text-left hover:text-blue-600 flex items-center gap-1.5 focus:outline-none cursor-pointer"
                    >
                      {task.title}
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </button>
                    <span className="text-[10px] font-mono text-slate-400">
                      {task.completedAt ? new Date(task.completedAt).toLocaleTimeString() : ""}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {task.description}
                  </p>
                </div>

                {/* Expanded Logs & Failures */}
                {isExpanded && (
                  <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900/30 dark:border-slate-800 space-y-3 overflow-hidden">
                    {hasFailed && (
                      <div className="border border-red-200 bg-red-50/50 p-3 rounded-md dark:border-red-900/35 dark:bg-red-955/15 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 text-xs font-extrabold">
                          <AlertTriangle className="h-4 w-4" />
                          ErrorCode: {task.errorCode || "TASK_FAILURE"}
                        </div>
                        <p className="text-xs text-red-600 dark:text-red-400/90 font-semibold leading-relaxed">
                          {task.errorMessage}
                        </p>
                        {task.fixSuggestion && (
                          <div className="mt-2 pt-2 border-t border-red-100 dark:border-red-900/20">
                            <span className="text-[10px] font-extrabold text-red-800 dark:text-red-400 uppercase tracking-wider block">
                              Suggested Fix
                            </span>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400/80">
                              {task.fixSuggestion}
                            </p>
                          </div>
                        )}
                        {task.aiExplanation ? (
                          <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-900/20 space-y-3">
                            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 text-xs font-extrabold">
                              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                              Gemini AI Migration Diagnosis
                            </div>
                            <div className="space-y-3 bg-[#F5F3FF] dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/35">
                              <div className="space-y-1">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                  AI Analysis
                                </span>
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                                  {task.aiExplanation.explanation}
                                </p>
                              </div>
                              <div className="space-y-1 pt-2 border-t border-indigo-100/50 dark:border-indigo-900/20">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#64748b]">
                                  Likely Root Cause
                                </span>
                                <p className="text-xs font-semibold text-[#ef4444] dark:text-[#f87171] leading-relaxed flex items-start gap-1">
                                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                  {task.aiExplanation.likelyCause}
                                </p>
                              </div>
                              <div className="space-y-2 pt-2 border-t border-indigo-100/50 dark:border-indigo-900/20">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#64748b]">
                                  Remediation Steps
                                </span>
                                <ul className="space-y-2">
                                  {task.aiExplanation.remediationSteps &&
                                    task.aiExplanation.remediationSteps.map(
                                      (step: string, index: number) => (
                                        <li
                                          key={index}
                                          className="flex gap-2 items-start text-xs font-semibold text-slate-700 dark:text-slate-300"
                                        >
                                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                                            {index + 1}
                                          </span>
                                          <span className="pt-0.5 leading-relaxed">
                                            {step}
                                          </span>
                                        </li>
                                      )
                                    )}
                                </ul>
                              </div>
                              <div className="space-y-1 pt-2 border-t border-indigo-100/50 dark:border-indigo-900/20">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#64748b]">
                                  Alternative Fallback Option
                                </span>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 italic leading-relaxed">
                                  {task.aiExplanation.alternativeFallback}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 pt-2 border-t border-red-100 dark:border-red-900/20 flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleExplainTask(task.key)}
                              disabled={explainingTasks[task.key]}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] h-7 px-2.5 flex items-center gap-1 shadow-sm rounded-md cursor-pointer"
                            >
                              {explainingTasks[task.key] ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3" /> Explain with AI
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Task Log message list */}
                    <div className="space-y-1 max-h-[220px] overflow-auto">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#94a3b8] block">
                        Task Execution Logs
                      </span>
                      {task.logs && task.logs.length > 0 ? (
                        task.logs.map((log, idx) => (
                          <div key={idx} className="flex gap-2 text-xs font-mono py-1">
                            <span className="text-[#94a3b8] shrink-0">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span
                              className={
                                log.level === "error"
                                  ? "text-red-500 font-extrabold"
                                  : log.level === "warning"
                                  ? "text-amber-500 font-extrabold"
                                  : "text-slate-600 dark:text-slate-400"
                              }
                            >
                              {log.message}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-[#94a3b8] font-semibold italic">
                          No logs recorded yet.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
