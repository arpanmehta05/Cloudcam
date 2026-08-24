import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlarmActions } from "./AlarmActions";

interface AlarmRowProps {
  alarm: any;
  idx: number;
  processingStatus?: "deleting" | "toggling";
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function isDefaultAlarm(alarm: any): boolean {
  return (
    typeof alarm?.name === "string" && alarm.name.startsWith("rabbittwatch-")
  );
}

export function AlarmRow({
  alarm,
  idx,
  processingStatus,
  onToggle,
  onEdit,
  onDelete,
}: AlarmRowProps) {
  const stateUpper = alarm.state?.toUpperCase();
  const isAlarm = stateUpper === "ALARM";
  const isOk = stateUpper === "OK";
  const defaultAlarm = isDefaultAlarm(alarm);

  return (
    <tr className="group hover:bg-primary/[0.02] transition-colors">
      <td className="py-3 px-6">
        <p className="font-bold text-sm text-foreground tracking-tight">
          {alarm.name}
        </p>
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-tighter mt-1">
          ID: {idx + 1000}
        </p>
      </td>
      <td className="py-3 px-6">
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider shadow-sm",
            isAlarm
              ? "bg-destructive/10 border-destructive/20 text-destructive shadow-destructive/5"
              : isOk
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/5"
                : "bg-muted border-border/60 text-muted-foreground"
          )}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              isAlarm
                ? "bg-destructive shadow-[0_0_8px_rgba(var(--destructive),0.5)]"
                : isOk
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-muted-foreground"
            )}
          />
          {stateUpper || "UNKNOWN"}
        </div>
      </td>
      <td className="py-3 px-6 text-xs font-mono text-muted-foreground uppercase">
        {alarm.namespace}
      </td>
      <td className="py-3 px-6 text-xs font-bold text-foreground/80">
        {alarm.metric}
      </td>
      <td className="py-3 px-6">
        <p
          className="text-xs text-muted-foreground max-w-[280px] truncate leading-relaxed"
          title={alarm.reason}
        >
          {alarm.reason || "Monitoring telemetry parameters..."}
        </p>
      </td>
      <td className="py-3 px-6">
        <AlarmActions
          alarm={alarm}
          processingStatus={processingStatus}
          defaultAlarm={defaultAlarm}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}
