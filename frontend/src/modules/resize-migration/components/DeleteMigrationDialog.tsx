import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "@/icons";
import { MigrationListPanelProps } from "./MigrationListPanel.types";

type Props = Pick<
  MigrationListPanelProps,
  | "deleteConfirmJobId"
  | "setDeleteConfirmJobId"
  | "isDeleting"
  | "handleConfirmDelete"
>;

export function DeleteMigrationDialog({
  deleteConfirmJobId,
  setDeleteConfirmJobId,
  isDeleting,
  handleConfirmDelete,
}: Props) {
  return (
    <Dialog
      open={!!deleteConfirmJobId}
      onOpenChange={(open) => {
        if (!open) setDeleteConfirmJobId(null);
      }}
    >
      <DialogContent className="max-w-md rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#0f172a] shadow-2xl p-0 overflow-hidden">
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/40 px-6 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <DialogTitle className="text-base font-extrabold text-red-700 dark:text-red-400">
              Delete Migration Job
            </DialogTitle>
            <DialogDescription className="text-xs text-red-500/80 dark:text-red-400/70 mt-0.5">
              This action cannot be undone
            </DialogDescription>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-650 dark:text-slate-305 leading-relaxed">
            You are about to permanently delete this resize migration job and
            its entire timeline — including all tasks, logs, and audit
            history.
          </p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-650 dark:text-slate-305">
              Job ID:{" "}
              <span className="font-mono text-slate-800 dark:text-slate-100">
                #{deleteConfirmJobId?.slice(-6)}
              </span>
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 h-10 text-sm font-extrabold border-slate-200 dark:border-slate-700 rounded-xl"
              onClick={() => setDeleteConfirmJobId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-10 text-sm font-extrabold bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl shadow-md transition-all"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Job
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
