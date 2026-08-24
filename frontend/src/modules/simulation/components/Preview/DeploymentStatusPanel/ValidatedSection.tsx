"use client";

import React from "react";
import { Check, Rocket } from "@/icons";

interface ValidatedSectionProps {
  nodes: any[];
  mode: string;
  action: string;
  formRegion: string;
  accountInfo: {
    accountId: string;
  } | null;
  handleDeploy: () => void;
  setPhase: React.Dispatch<React.SetStateAction<any>>;
  setAccountInfo: (info: any) => void;
  setRegionLocked: (locked: boolean) => void;
  maskId: (id: string) => string;
}

export function ValidatedSection({
  nodes,
  mode,
  action,
  formRegion,
  accountInfo,
  handleDeploy,
  setPhase,
  setAccountInfo,
  setRegionLocked,
  maskId,
}: ValidatedSectionProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <Check className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-foreground">
            Cloud Authorization Success
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Your connection keys have been verified successfully.
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 text-left space-y-2 shadow-xs select-text">
          {mode === "simulation" && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-semibold">
                Simulation Canvas:
              </span>
              <span className="font-extrabold text-foreground">
                {nodes.length} nodes to create
              </span>
            </div>
          )}
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-semibold">
              Region:
            </span>
            <span className="font-extrabold text-foreground">
              {formRegion}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-semibold">
              Account Identity:
            </span>
            <span className="font-mono text-[10px] text-foreground font-semibold truncate max-w-[200px] select-text">
              {accountInfo ? maskId(accountInfo.accountId) : "Unknown"}
            </span>
          </div>
        </div>

        <button
          onClick={handleDeploy}
          className="simulation-action simulation-action-primary w-full py-3 text-sm cursor-pointer"
        >
          <Rocket className="h-4 w-4 mr-2 animate-pulse" />
          {mode === "live-action"
            ? `Execute ${action}`
            : `Deploy ${nodes.length} Resources`}
        </button>

        <button
          onClick={() => {
            setPhase("creds");
            setAccountInfo(null);
            setRegionLocked(false);
          }}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition underline block mx-auto font-bold cursor-pointer"
        >
          Configure different credentials
        </button>
      </div>
    </div>
  );
}
