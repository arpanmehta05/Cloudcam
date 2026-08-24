"use client";

import { Rocket, X } from "@/icons";

interface PanelHeaderProps {
  mode: "simulation" | "live-action";
  action: string;
  resourceLabel: string;
  resourceCount: number;
  region: string;
  onClose: () => void;
}

export function PanelHeader({
  mode,
  action,
  resourceLabel,
  resourceCount,
  region,
  onClose,
}: PanelHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-4 shrink-0 bg-card/90 backdrop-blur">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
        <Rocket className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-extrabold text-foreground truncate">
          {mode === "live-action"
            ? "Execute Live Action"
            : "Deploy Infrastructure"}
        </h2>
        <p className="text-[11px] font-semibold text-muted-foreground truncate">
          {mode === "live-action"
            ? `${action} ${resourceLabel}`
            : `${resourceCount} resources`}{" "}
          · {region}
        </p>
      </div>
      <button
        onClick={onClose}
        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
