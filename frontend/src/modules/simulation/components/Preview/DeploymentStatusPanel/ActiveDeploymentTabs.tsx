"use client";

import React from "react";
import {
  Loader2,
  Check,
  FileText,
  Terminal,
  Server,
  Download,
  ChevronUp,
  ChevronDown,
  Key,
  AlertCircle,
} from "@/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeploymentLogs } from "./DeploymentLogs";
import { OutputsPanel } from "./OutputsPanel";
import { StagingTimeline } from "./StagingTimeline";
import { authFetch } from "@/lib/auth-fetch";
import { logSimulationAction } from "@/lib/simulation-action-log";

interface ActiveDeploymentTabsProps {
  state: any;
  mode: "simulation" | "live-action";
  action: string;
  resourceLabel: string;
  service?: string;
  name?: string;
  draftId?: string | null;
  onClose: () => void;
}

export function ActiveDeploymentTabs({
  state,
  mode,
  action,
  resourceLabel,
  service,
  name,
  draftId,
  onClose,
}: ActiveDeploymentTabsProps) {
  const logEndRef = React.useRef<HTMLDivElement | null>(null);

  const isInstructionsDisabled = state.ecrOutputs.length === 0;
  const hasOutputs = Object.keys(state.outputs).length > 0;
  const isOutputsDisabled = !hasOutputs;

  return (
    <div className="space-y-4">
      {/* Phase Status Card */}
      {state.phase === "awaiting_image_upload" && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-foreground">
              Stage 1 Complete: {state.registryLabel} Registry Active
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Container registry has been created successfully. Upload your container image to {state.registryLabel} before resuming Stage 2 (deploying compute resources).
            </p>
          </div>
        </div>
      )}

      {state.phase === "running" && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-foreground">
              {state.runnerReportedSuccessRef.current
                ? "Deployment Complete - Finalizing Outputs"
                : "Execution Environment Live"}
            </span>
          </div>
          <Badge
            variant="outline"
            className="bg-blue-500/5 text-blue-500 border-blue-500/20 text-[9px] animate-pulse"
          >
            {state.runnerReportedSuccessRef.current
              ? "Finalizing"
              : "Executing"}
          </Badge>
        </div>
      )}

      {state.phase === "complete" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <Check className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground">
              {mode === "live-action"
                ? "Action Successful!"
                : "Deployment Successful!"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === "live-action"
                ? `The action "${action}" has been successfully executed.`
                : `Your virtual infrastructure is active on ${state.providerLabel} Cloud.`}
            </p>
          </div>
        </div>
      )}

      {state.phase === "failed" && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground">
              {mode === "live-action"
                ? "Action Failed"
                : "Deployment Terminated"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Resource manager returned execution failures.
            </p>
          </div>
        </div>
      )}

      {/* Staging Pipeline Timeline */}
      <StagingTimeline
        hasEcr={state.hasEcr}
        stage1Status={state.stage1Status}
        stage2Status={state.stage2Status}
        stage3Status={state.stage3Status}
      />

      {/* Horizontal Tab Switcher */}
      <div className="flex border-b border-border mb-4 gap-6 select-none">
        {state.hasEcr && (
          <button
            onClick={() => state.setActiveTab("instructions")}
            disabled={isInstructionsDisabled}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 px-1 relative -mb-px disabled:opacity-50 disabled:cursor-not-allowed ${
              state.activeTab === "instructions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>Push Instructions</span>
            </div>
          </button>
        )}
        <button
          onClick={() => state.setActiveTab("logs")}
          className={`pb-2.5 text-xs font-bold transition-all border-b-2 px-1 relative -mb-px ${
            state.activeTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            <span>Provisioning Logs</span>
          </div>
        </button>
        <button
          onClick={() => state.setActiveTab("outputs")}
          disabled={isOutputsDisabled}
          className={`pb-2.5 text-xs font-bold transition-all border-b-2 px-1 relative -mb-px disabled:opacity-50 disabled:cursor-not-allowed ${
            state.activeTab === "outputs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" />
            <span>Outputs & Keys</span>
          </div>
        </button>
      </div>

      {/* Active Tab Views */}
      {state.activeTab === "instructions" && state.hasEcr && (
        <div className="space-y-4">
          {/* Dynamic push shell script buttons */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-bold text-foreground">Download Interactive Push Script</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Automate the local login, build, tag, and push process with a pre-configured script.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={state.downloadBashScript}
                variant="outline"
                className="h-9 text-[10px] font-bold border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>push-to-ecr.sh (Linux/Mac)</span>
              </Button>
              <Button
                onClick={state.downloadPowerShellScript}
                variant="outline"
                className="h-9 text-[10px] font-bold border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center gap-1.5"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>push-to-ecr.ps1 (Win)</span>
              </Button>
            </div>
          </div>

          {/* ECR repository command blocks */}
          {state.ecrOutputs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
              No ECR repository URL found in Stage 1 outputs.
            </div>
          ) : (
            <div className="space-y-4">
              {state.ecrOutputs.map((ecr: any) => {
                const pushInstKey = `${ecr.key.replace("ecr_url_", "")}_push_instructions`;
                return (
                  <OutputsPanel
                    key={ecr.key}
                    phase={state.phase}
                    error={state.error}
                    logs={state.logs}
                    mode={mode}
                    outputs={{
                      [ecr.key]: ecr.url,
                      [pushInstKey]: state.outputs[pushInstKey]?.value || state.outputs[pushInstKey],
                    }}
                    provider={state.provider}
                    formRegion={state.formRegion}
                    action={action}
                    resourceLabel={resourceLabel}
                    service={service}
                    deploymentId={state.deploymentId}
                    name={name || resourceLabel}
                    handleDownloadPem={state.handleDownloadPem}
                    handleCopyUrl={state.handleCopyUrl}
                    copiedUrls={state.copiedUrls}
                    resolveSshKeyName={state.resolveSshKeyName}
                    onRestartConnection={() => {}}
                  />
                );
              })}
            </div>
          )}

          {/* Collapsible Credentials panel */}
          {state.provider === "aws" && (
            <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
              <button
                onClick={() => state.setShowCredsUpdate(!state.showCredsUpdate)}
                className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition text-xs font-bold text-foreground animate-none"
              >
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" />
                  <span>Update AWS Credentials (Session Expired?)</span>
                </div>
                {state.showCredsUpdate ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {state.showCredsUpdate && (
                <div className="p-4 border-t border-border space-y-3 bg-card/10 select-text">
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    If your AWS token expired while building or pushing your container, paste your new credentials below. They will be saved in-memory and used for the resume verification step.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="updateAccessKeyId" className="mb-1 block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        Access Key ID
                      </label>
                      <input
                        id="updateAccessKeyId"
                        type="text"
                        value={state.accessKeyId}
                        onChange={(e) => state.setAccessKeyId(e.target.value)}
                        placeholder="AKIA..."
                        className="h-9 w-full rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="updateSecretAccessKey" className="mb-1 block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        Secret Access Key
                      </label>
                      <input
                        id="updateSecretAccessKey"
                        type="password"
                        value={state.secretAccessKey}
                        onChange={(e) => state.setSecretAccessKey(e.target.value)}
                        placeholder="••••••••••••••••••••"
                        className="h-9 w-full rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="updateSessionToken" className="mb-1 block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        Session Token
                      </label>
                      <textarea
                        id="updateSessionToken"
                        value={state.sessionToken}
                        onChange={(e) => state.setSessionToken(e.target.value)}
                        placeholder="STS Session Token"
                        className="h-16 w-full rounded-md border border-border/80 bg-background px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-1">
                        <Check className="h-3 w-3" /> Credentials updated in-memory
                      </span>
                      <button
                        type="button"
                        onClick={() => state.setShowCredsUpdate(false)}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Minimize
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action button if currently awaiting_image_upload */}
          {state.phase === "awaiting_image_upload" && (
            <button
              onClick={state.handleResume}
              disabled={state.isResuming}
              className="simulation-action simulation-action-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 mt-2"
            >
              {state.isResuming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verifying Image Presence in {state.providerLabel}...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Image Uploaded & Resume
                </>
              )}
            </button>
          )}
        </div>
      )}

      {state.activeTab === "logs" && (
        <div className="space-y-4">
          <DeploymentLogs
            logs={state.logs}
            logEndRef={logEndRef}
            copied={state.copied}
            onCopyLogs={state.handleCopyLogs}
          />

          {state.phase === "running" && !state.runnerReportedSuccessRef.current && (
            <button
              onClick={async () => {
                if (state.deploymentId) {
                  await authFetch(
                    `/api/deployment/${state.deploymentId}/cancel`,
                    { method: "POST" },
                  );
                  void logSimulationAction({
                    actionId:
                      mode === "live-action"
                        ? "live-action-failed"
                        : "simulation-deployment-failed",
                    displayName:
                      mode === "live-action"
                        ? `Cancelled live ${action}: ${resourceLabel}`
                        : `Cancelled deployment: ${name}`,
                    status: "failed",
                    region: state.formRegion,
                    simulationId:
                      mode === "simulation" ? draftId : undefined,
                    simulationName:
                      mode === "simulation" ? name : undefined,
                    target: {
                      resourceId: state.deploymentId,
                      resourceName:
                        mode === "live-action" ? resourceLabel : name,
                    },
                  });
                  onClose();
                }
              }}
              className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10 transition"
            >
              Force Cancel Deployment
            </button>
          )}
        </div>
      )}

      {state.activeTab === "outputs" && (
        <OutputsPanel
          phase={state.phase}
          error={state.error}
          logs={state.logs}
          mode={mode}
          outputs={state.outputs}
          provider={state.provider}
          formRegion={state.formRegion}
          action={action}
          resourceLabel={resourceLabel}
          service={service}
          deploymentId={state.deploymentId}
          name={name || resourceLabel}
          handleDownloadPem={state.handleDownloadPem}
          handleCopyUrl={state.handleCopyUrl}
          copiedUrls={state.copiedUrls}
          resolveSshKeyName={state.resolveSshKeyName}
          onRestartConnection={state.restartConnection}
        />
      )}
    </div>
  );
}
