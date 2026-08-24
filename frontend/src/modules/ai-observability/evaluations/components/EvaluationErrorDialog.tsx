"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Lightbulb, RefreshCw, ShieldCheck } from "@/icons";

import type { EvaluationErrorModalState } from "../types";

interface EvaluationErrorDialogProps {
  errorModal: EvaluationErrorModalState;
  setErrorModal: React.Dispatch<React.SetStateAction<EvaluationErrorModalState>>;
  handleRunAudit: (requestId: string) => void;
}

export function EvaluationErrorDialog({
  errorModal,
  setErrorModal,
  handleRunAudit,
}: EvaluationErrorDialogProps) {
  return (
    <Dialog open={errorModal.isOpen} onOpenChange={(open) => setErrorModal((prev) => ({ ...prev, isOpen: open }))}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto border border-red-500/20 dark:border-red-500/30 bg-background backdrop-blur-md shadow-2xl rounded-2xl p-6">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 dark:bg-red-500/20">
            <AlertCircle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-display text-lg font-bold tracking-tight text-foreground">
            {errorModal.title}
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-muted-foreground">
            An error occurred while running the LLM-as-a-Judge quality evaluation.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-secondary/5 p-3.5 font-mono text-[11px] leading-relaxed break-words text-muted-foreground max-h-40 overflow-y-auto">
            <div className="flex justify-between border-b border-border/60 pb-1.5 mb-2 text-[9px] uppercase tracking-wider text-muted-foreground/60">
              <span>Error Log</span>
              {errorModal.requestId && (
                <span>ID: {errorModal.requestId.slice(0, 8)}...</span>
              )}
            </div>
            <span className="text-red-400 font-semibold font-mono block whitespace-pre-wrap">{errorModal.message}</span>
          </div>

          {errorModal.isKeyError ? (
            <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-500/90 dark:text-amber-400/90">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> API Key Configuration Required
              </p>
              <p className="text-[11px]">
                The judge API key entered on this Evaluations page is invalid, missing, or has insufficient scopes. Manual audits only use the key from the Custom API Key input, not Settings or AI Providers.
              </p>
            </div>
          ) : errorModal.isRateLimit ? (
            <div className="rounded-lg border border-orange-500/15 bg-orange-500/5 p-3 text-xs leading-relaxed text-orange-500/90 dark:text-orange-400/90">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 shrink-0" /> Rate limit / quota exceeded
              </p>
              <p className="text-[11px]">
                The judge model hit its provider quota (HTTP 429). Wait a minute and retry, pick a
                model with available quota (e.g. <span className="font-mono">gemini-2.5-flash</span>),
                or use a key with billing enabled. Some models have a 0 free-tier limit.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-indigo-500/10 bg-indigo-500/5 p-3 text-xs leading-relaxed text-indigo-400">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Troubleshooting Tip</span>
              </p>
              <p className="text-[11px]">
                Check the provider, model name, and Custom API Key entered in Judge Settings, then retry the audit.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 sm:justify-between flex-col sm:flex-row gap-2">
          {errorModal.requestId ? (
            <Button
              onClick={() => {
                const reqId = errorModal.requestId;
                setErrorModal((prev) => ({ ...prev, isOpen: false }));
                if (reqId) handleRunAudit(reqId);
              }}
              className="w-full sm:w-auto font-mono text-xs gap-1.5"
              variant="outline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Audit
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => setErrorModal((prev) => ({ ...prev, isOpen: false }))}
            className="w-full sm:w-auto font-mono text-xs"
          >
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
