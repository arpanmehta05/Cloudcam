"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Play,
  AlertTriangle,
  Shield,
  CheckCircle,
  Loader2,
  Zap,
} from "@/icons";
import { authFetch } from "@/lib/auth-fetch";

interface ActionTarget {
  resourceId: string;
  resourceName: string;
  region: string;
  currentState?: any;
  proposedState?: string;
}

interface SafetyResult {
  safe: boolean;
  simulationMode?: boolean;
  warnings: string[];
  blockers: string[];
  dependencyWarnings?: string[];
  downtimeWarning?: string;
}
import { emitActionExecutionEvent } from "@/lib/action-events";

interface ActionPreview {
  actionDef: {
    id: string;
    name: string;
    description: string;
    service: string;
    riskLevel: string;
    tier: number;
    reversible: boolean;
  };
  targets: ActionTarget[];
  safety: SafetyResult;
  simulationMode: boolean;
  estimatedSavings: number;
}

interface ActionPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
  targets: { resourceId: string; resourceName: string; region: string }[];
  estimatedSavings?: number;
  reasoning?: string;
  onActionComplete?: (result: any) => void;
  allowLiveExecution?: boolean;
}

const riskColors: Record<string, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200",
  high: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-950/30 dark:text-orange-200",
  critical:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200",
};

export function ActionPreviewDrawer({
  isOpen,
  onClose,
  actionId,
  targets,
  estimatedSavings = 0,
  reasoning,
  onActionComplete,
  allowLiveExecution = false,
}: ActionPreviewDrawerProps) {
  const [preview, setPreview] = useState<ActionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"preview" | "confirm" | "result">("preview");
  const [manualTargetInput, setManualTargetInput] = useState("");
  const [localTargets, setLocalTargets] = useState(targets);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showForceDeleteFlow, setShowForceDeleteFlow] = useState(false);
  const [forceDeleteInput, setForceDeleteInput] = useState("");

  const isS3DeleteAction = actionId === "s3-delete-bucket";
  const effectiveLiveMode = allowLiveExecution && isLiveMode;
  const forceDeleteTargetLabel =
    localTargets.length === 1 ? localTargets[0].resourceId : "ALL TARGETS";
  const expectedForceDeletePhrase = `FORCE DELETE ${forceDeleteTargetLabel}`;

  const isBucketNotEmptyError = (message?: string): boolean => {
    const text = (message || "").toLowerCase();
    return text.includes("bucket") && text.includes("not empty");
  };

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/api/aws/actions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, targets: localTargets }),
      });
      const data = await response.json();
      if (data.success) {
        setPreview(data.preview);
        setStep("confirm");
      } else {
        setError(data.error || "Failed to preview action");
      }
    } catch (err) {
      setError((err as any)?.message || "Failed to connect to action service");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTarget = () => {
    const id = manualTargetInput.trim();
    if (!id) return;
    setLocalTargets((prev) => [
      ...prev,
      { resourceId: id, resourceName: id, region: "us-east-1" },
    ]);
    setManualTargetInput("");
  };

  const handleRemoveTarget = (idx: number) => {
    setLocalTargets((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExecute = async (forceEmptyDelete: boolean = false) => {
    if (!preview) return;
    setExecuting(true);
    setError(null);
    try {
      // Create action request first
      const planTargets = localTargets.map((target) => {
        if (forceEmptyDelete && isS3DeleteAction) {
          return { ...target, proposedState: "force-empty-delete" };
        }
        return target;
      });

      const createRes = await authFetch("/api/aws/actions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: {
            actionId,
            targets: planTargets,
            estimatedSavings,
            riskLevel: preview.actionDef.riskLevel,
            reasoning: reasoning || "",
            warnings: [
              ...preview.safety.warnings,
              ...(forceEmptyDelete && isS3DeleteAction
                ? [
                    "Force-empty-delete enabled: all objects, versions, and delete markers will be permanently removed.",
                  ]
                : []),
            ],
          },
          simulationMode: true,
        }),
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error);

      const approveRes = await authFetch(
        `/api/aws/actions/approve/${createData.actionRequest._id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simulationMode: true }),
        },
      );
      const approveData = await approveRes.json();
      if (!approveData.success)
        throw new Error(approveData.error || "Approval failed");

      // Execute it
      const execRes = await authFetch(
        `/api/aws/actions/execute/${createData.actionRequest._id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const execData = await execRes.json();
      if (execData.success) {
        setResult(execData.actionRequest);
        setStep("result");
        emitActionExecutionEvent({
          actionRequestId: execData.actionRequest?._id,
          actionId,
          status: execData.actionRequest?.status,
          source: "action-preview-drawer",
        });
        onActionComplete?.(execData.actionRequest);
      } else {
        setError(execData.error || "Execution failed");
      }
    } catch (err: any) {
      const targetFailure = err?.details?.targetErrors?.[0]?.error;
      const errorText =
        targetFailure || err?.message || "Failed to execute action";
      setError(errorText);
      emitActionExecutionEvent({
        actionId,
        status: "failed",
        message: errorText,
        source: "action-preview-drawer",
      });

      if (
        isS3DeleteAction &&
        isBucketNotEmptyError(errorText) &&
        effectiveLiveMode &&
        !forceEmptyDelete
      ) {
        setShowForceDeleteFlow(true);
      }
    } finally {
      setExecuting(false);
    }
  };

  const handleForceDeleteConfirm = async () => {
    if (forceDeleteInput.trim() !== expectedForceDeletePhrase) {
      setError(
        `Confirmation phrase mismatch. Type exactly: ${expectedForceDeletePhrase}`,
      );
      return;
    }
    await handleExecute(true);
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-20 z-[140] bg-slate-950/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-[#E2E8F0] bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.20)] dark:border-[#24344D] dark:bg-[#07111F]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-6 py-5 dark:border-[#24344D] dark:bg-[#07111F]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
                <Zap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">
                  Action preview
                </p>
                <h2 className="mt-1 truncate text-lg font-extrabold text-[#020617] dark:text-white">
                  {actionId}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/30 dark:text-[#94A3B8] dark:hover:bg-[#10213A] dark:hover:text-white"
              aria-label="Close action preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Mode Toggle */}
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 dark:border-[#24344D] dark:bg-[#0B1728]">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-[#64748B] dark:text-[#94A3B8]" />
              <span className="text-xs font-extrabold text-[#0F172A] dark:text-white">
                Execution mode
              </span>
            </div>
            {allowLiveExecution ? (
              <button
                onClick={() => setIsLiveMode(!isLiveMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                  effectiveLiveMode ? "bg-red-500" : "bg-[#1A56DB]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    effectiveLiveMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            ) : (
              <span className="inline-flex h-6 items-center rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#1A56DB] dark:border-[#1D4ED8]/50 dark:bg-[#10213A] dark:text-[#6BA3F8]">
                Locked
              </span>
            )}
            <span
              className={`min-w-[72px] text-right text-xs font-extrabold ${
                effectiveLiveMode ? "text-red-600" : "text-[#1A56DB]"
              }`}
            >
              {effectiveLiveMode ? "Live" : "Simulate"}
            </span>
          </div>
          {effectiveLiveMode && (
            <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-600">
                Live mode will make real changes to your AWS infrastructure.
                Ensure you have reviewed all targets and safety checks.
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto bg-[#F8FAFC] p-5 dark:bg-[#050D1A]">
          {/* Action Info */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-[#24344D] dark:bg-[#07111F]">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="min-w-0 flex-1 truncate text-base font-extrabold text-[#020617] dark:text-white">
                {preview?.actionDef.name || actionId}
              </h3>
              {preview && (
                <Badge
                  className={`border text-[10px] ${riskColors[preview.actionDef.riskLevel]}`}
                >
                  {preview.actionDef.riskLevel} risk
                </Badge>
              )}
            </div>
            {preview && (
              <p className="text-sm font-medium leading-6 text-[#64748B] dark:text-[#94A3B8]">
                {preview.actionDef.description}
              </p>
            )}
            {reasoning && (
              <p className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-medium leading-5 text-[#64748B] dark:border-[#24344D] dark:bg-[#0B1728] dark:text-[#94A3B8]">
                {reasoning}
              </p>
            )}
          </div>

          {/* Targets */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-[#24344D] dark:bg-[#07111F]">
            <h4 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">
              Targets ({localTargets.length})
            </h4>
            {localTargets.length === 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-xs font-extrabold text-amber-800 dark:text-amber-100">
                      No targets specified
                    </p>
                    <p className="mt-1 text-xs font-medium leading-5 text-amber-700 dark:text-amber-200">
                      The AI couldn&apos;t determine specific resource IDs. Add
                      them below (e.g. S3 bucket name, EC2 instance ID).
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {localTargets.map((target, i) => (
                <Card
                  key={i}
                  className="border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#24344D] dark:bg-[#0B1728]"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#020617] dark:text-white">
                        {target.resourceName || target.resourceId}
                      </p>
                      <p className="truncate text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                        {target.resourceId} - {target.region}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveTarget(i)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#64748B] transition hover:bg-red-50 hover:text-red-600 dark:text-[#94A3B8] dark:hover:bg-red-950/30 dark:hover:text-red-200"
                      aria-label="Remove target"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
            {/* Add target input */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={manualTargetInput}
                onChange={(e) => setManualTargetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTarget()}
                placeholder="Enter resource ID (e.g. my-bucket-name)"
                className="h-9 min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] outline-none transition focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 dark:border-[#24344D] dark:bg-[#0B1728] dark:text-white"
              />
              <Button
                onClick={handleAddTarget}
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                disabled={!manualTargetInput.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Safety Checks */}
          {preview?.safety && (
            <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-[#24344D] dark:bg-[#07111F]">
              <h4 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">
                Safety Analysis
              </h4>
              {preview.safety.blockers.length > 0 && (
                <div className="space-y-2 mb-3">
                  {preview.safety.blockers.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-950/30"
                    >
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <span className="text-xs font-medium leading-5 text-red-700 dark:text-red-200">
                        {b}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {preview.safety.warnings.length > 0 && (
                <div className="space-y-2 mb-3">
                  {preview.safety.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-950/30"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-xs font-medium leading-5 text-amber-700 dark:text-amber-200">
                        {w}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {preview.safety.safe &&
                preview.safety.blockers.length === 0 &&
                preview.safety.warnings.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-950/30">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                      All safety checks passed
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* Savings */}
          {estimatedSavings > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-200">
                ${estimatedSavings.toFixed(2)}/mo
              </p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-700/80 dark:text-emerald-200/80">
                Estimated monthly savings
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}

          {showForceDeleteFlow && step === "confirm" && isS3DeleteAction && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-950/30">
              <p className="text-xs font-extrabold text-red-700 dark:text-red-200">
                High-risk irreversible action.
              </p>
              <p className="text-xs font-medium leading-5 text-red-600 dark:text-red-200">
                This will permanently delete all objects, versions, and delete
                markers in this bucket before deleting the bucket.
              </p>
              <p className="font-mono text-[11px] text-red-700 dark:text-red-200">
                Type: {expectedForceDeletePhrase}
              </p>
              <input
                type="text"
                value={forceDeleteInput}
                onChange={(e) => setForceDeleteInput(e.target.value)}
                placeholder={expectedForceDeletePhrase}
                className="h-9 w-full rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-[#0F172A] outline-none focus:ring-2 focus:ring-red-300 dark:border-red-500/30 dark:bg-[#07111F] dark:text-white"
              />
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                disabled={
                  executing ||
                  forceDeleteInput.trim() !== expectedForceDeletePhrase
                }
                onClick={handleForceDeleteConfirm}
              >
                {executing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-2 h-4 w-4" />
                )}
                Force Empty & Delete
              </Button>
            </div>
          )}

          {/* Result */}
          {step === "result" && result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-200">
                  {result.status === "simulated"
                    ? "Simulation Complete"
                    : "Action Completed"}
                </span>
              </div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-200">
                Status: {result.status} - ID: {result._id}
              </p>
              {result.status === "simulated" && (
                <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-200">
                  No changes were made. Toggle to Live mode and re-run to apply
                  real changes.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#E2E8F0] bg-white px-6 py-4 dark:border-[#24344D] dark:bg-[#07111F]">
          {step === "preview" && (
            <Button
              onClick={fetchPreview}
              disabled={loading}
              className="h-11 w-full"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Run Safety Checks
            </Button>
          )}
          {step === "confirm" && (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={onClose} variant="outline" className="h-11">
                Cancel
              </Button>
              <Button
                onClick={() => handleExecute(false)}
                disabled={
                  executing || (preview?.safety.blockers.length ?? 0) > 0
                }
                className={`h-11 ${effectiveLiveMode ? "bg-red-600 text-white hover:bg-red-700" : ""}`}
              >
                {executing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {effectiveLiveMode ? "Execute Live" : "Simulate"}
              </Button>
            </div>
          )}
          {step === "result" && (
            <Button onClick={onClose} className="h-11 w-full">
              Done
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
