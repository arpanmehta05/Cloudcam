"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, Info, XCircle } from "@/icons";

interface ChecklistItem {
  label: string;
  detail: string;
  state: "done" | "undone" | "manual" | "pending";
}

interface WorkChecklistProps {
  checklistItems: ChecklistItem[];
}

export function WorkChecklist({ checklistItems }: WorkChecklistProps) {
  return (
    <Card className="border-[#e8eaee] bg-white shadow-sm dark:border-[#1E293B] dark:bg-[#0A1220]">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
        <CardTitle className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-emerald-500" /> Work Checklist
        </CardTitle>
        <CardDescription className="text-[11px] font-semibold text-slate-500">
          Live migration evidence grouped into done, pending, undone, or manual validation items.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-3">
        {checklistItems.map((item) => {
          const stateTone =
            item.state === "done"
              ? {
                  bg: "bg-emerald-50 dark:bg-emerald-950/20",
                  border: "border-emerald-200 dark:border-emerald-900/35",
                  text: "text-emerald-700 dark:text-emerald-400",
                  icon: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />,
                }
              : item.state === "undone"
              ? {
                  bg: "bg-red-50 dark:bg-red-950/20",
                  border: "border-red-200 dark:border-red-900/35",
                  text: "text-red-700 dark:text-red-400",
                  icon: <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />,
                }
              : item.state === "manual"
              ? {
                  bg: "bg-amber-50 dark:bg-amber-950/20",
                  border: "border-amber-200 dark:border-amber-900/35",
                  text: "text-amber-700 dark:text-amber-400",
                  icon: <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
                }
              : {
                  bg: "bg-slate-50 dark:bg-slate-900/30",
                  border: "border-slate-200 dark:border-slate-800",
                  text: "text-slate-700 dark:text-slate-300",
                  icon: <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />,
                };

          return (
            <div
              key={item.label}
              className={`rounded-xl border p-3 ${stateTone.bg} ${stateTone.border}`}
            >
              <div className="flex gap-3">
                {stateTone.icon}
                <div className="min-w-0 space-y-1">
                  <div className={`text-xs font-extrabold ${stateTone.text}`}>
                    {item.label}
                  </div>
                  <p className="text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-slate-400 break-all select-text">
                    {item.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
