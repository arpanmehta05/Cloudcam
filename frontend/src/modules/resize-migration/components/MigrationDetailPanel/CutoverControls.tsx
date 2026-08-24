"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, FileText, XCircle, Zap } from "@/icons";
import type { MigrationJob } from "../../types";

interface CutoverControlsProps {
  activeJob: MigrationJob;
  stopSourceAfterCutover: boolean;
  handleTransitionStatus: (status: string, payload?: any) => void;
  handleDownloadReport: () => void;
}

export function CutoverControls({
  activeJob,
  stopSourceAfterCutover,
  handleTransitionStatus,
  handleDownloadReport,
}: CutoverControlsProps) {
  if (!["awaiting_cutover", "cutover", "completed", "rolled_back"].includes(activeJob.status)) {
    return null;
  }

  return (
    <Card className="border-[#e8eaee] bg-white shadow-sm dark:border-[#1E293B] dark:bg-[#0A1220] select-text">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/50 dark:bg-slate-900/10">
        <CardTitle className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 font-sans">
          <Zap className="h-4 w-4 text-amber-500" /> Cutover & Rollback
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {activeJob.status === "awaiting_cutover" && (
          <>
            <div className="rounded-lg bg-orange-50/50 border border-orange-100 p-3 dark:bg-orange-950/10 dark:border-orange-900/20">
              <h5 className="text-xs font-extrabold text-orange-800 dark:text-orange-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-4.5 w-4.5 text-orange-500 shrink-0" />{" "}
                Cutover Operator Action Required
              </h5>
              <p className="text-[11px] font-semibold text-orange-700 dark:text-orange-500/90 leading-relaxed">
                Pre-cutover validation checks have successfully passed. Clicking Cutover will perform the route updates or EIP swaps as planned.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="stopSourceCheckbox"
                  checked={stopSourceAfterCutover}
                  readOnly
                  disabled
                  className="h-4 w-4 rounded border-slate-355 dark:border-slate-700 accent-blue-600 cursor-not-allowed opacity-60"
                />
                <Label
                  htmlFor="stopSourceCheckbox"
                  className="text-xs font-extrabold text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                >
                  Stop source server after cutover (locked by classification)
                </Label>
              </div>

              <Button
                onClick={() =>
                  handleTransitionStatus("cutover", {
                    stopSourceAfterCutover,
                  })
                }
                className="w-full bg-[#2563eb] text-white hover:bg-blue-700 font-extrabold text-xs h-10 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                Execute Cutover
              </Button>
            </div>
          </>
        )}

        {activeJob.status === "cutover" && (
          <div className="space-y-3">
            <div className="rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] p-3 dark:bg-emerald-950/10 dark:border-emerald-900/20">
              <h5 className="text-xs font-extrabold text-[#166534] dark:text-emerald-400 mb-1 flex items-center gap-1">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />{" "}
                Cutover Active
              </h5>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-500/90 leading-relaxed">
                Routing changes have been committed. Please run final manual verify checks on target. Once satisfied, close migration.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 pt-2">
              <Button
                onClick={() => handleTransitionStatus("completed")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 shadow-sm cursor-pointer"
              >
                Approve & Close
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTransitionStatus("rolled_back")}
                className="border-red-200 text-red-650 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/20 font-extrabold text-xs h-9 cursor-pointer"
              >
                Rollback
              </Button>
            </div>
          </div>
        )}

        {activeJob.status === "completed" && (
          <div className="space-y-3.5">
            <div className="rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] p-3 dark:bg-emerald-950/10 dark:border-emerald-900/20">
              <h5 className="text-xs font-extrabold text-[#166534] dark:text-emerald-400 mb-1 flex items-center gap-1">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />{" "}
                Migration Succeeded
              </h5>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-500/90 leading-relaxed">
                This server migration is complete. Cutover route is active and audit history is sealed.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleDownloadReport}
              className="w-full border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-955/20 text-xs font-extrabold h-9 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="h-4 w-4" /> Download Audit Report (PDF)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleTransitionStatus("rolled_back")}
              className="w-full border-red-250 text-red-650 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-955/20 text-xs font-extrabold h-9 cursor-pointer"
            >
              Rollback (Post-Cutover)
            </Button>
          </div>
        )}

        {activeJob.status === "rolled_back" && (
          <div className="rounded-lg bg-pink-50/50 border border-pink-100 p-3 dark:bg-pink-955/10 dark:border-pink-900/20">
            <h5 className="text-xs font-extrabold text-pink-800 dark:text-pink-400 mb-1 flex items-center gap-1">
              <XCircle className="h-4.5 w-4.5 text-pink-500 shrink-0" />{" "}
              Migration Rolled Back
            </h5>
            <p className="text-[11px] font-semibold text-pink-700 dark:text-pink-500/90 leading-relaxed">
              The migration has been rolled back. Original source server configurations are active and target server has been preserved for inspection.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
