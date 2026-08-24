import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Trash2 } from "@/icons";
import { cn } from "@/lib/utils";

interface AlarmActionsProps {
  alarm: any;
  processingStatus?: "deleting" | "toggling";
  defaultAlarm: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AlarmActions({
  alarm,
  processingStatus,
  defaultAlarm,
  onToggle,
  onEdit,
  onDelete,
}: AlarmActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          alarm.actionsEnabled
            ? "bg-emerald-500/90 border-emerald-500"
            : "bg-muted border-border"
        )}
        aria-label={`${alarm.actionsEnabled ? "Disable" : "Enable"} alarm actions for ${alarm.name}`}
        title={
          alarm.actionsEnabled
            ? "Disable alarm actions"
            : "Enable alarm actions"
        }
        disabled={!!processingStatus}
        onClick={() => onToggle(!alarm.actionsEnabled)}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-background shadow transition-transform flex items-center justify-center",
            alarm.actionsEnabled ? "translate-x-5" : "translate-x-0.5"
          )}
        >
          {processingStatus === "toggling" && (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        title={
          defaultAlarm
            ? "Default alarms cannot be edited"
            : "Edit alarm"
        }
        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
        onClick={onEdit}
        disabled={
          alarm.type === "composite" ||
          defaultAlarm ||
          !!processingStatus
        }
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Delete alarm"
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
        onClick={onDelete}
        disabled={!!processingStatus}
      >
        {processingStatus === "deleting" ? (
          <Loader2 className="h-4 w-4 animate-spin text-destructive" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
