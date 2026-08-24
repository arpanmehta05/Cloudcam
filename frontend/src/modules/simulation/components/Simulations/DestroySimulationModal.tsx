"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Key, Terminal, RefreshCw, AlertCircle, Trash2 } from "@/icons";
import { authFetch, buildApiUrl, getAuthToken } from "@/lib/auth-fetch";
import { AwsCredentialVaultPicker } from "@/components/AwsCredentialVaultPicker";
import type { CredentialSelection } from "@/lib/aws-credential-vault";
import { logSimulationAction } from "@/lib/simulation-action-log";
import type { PersistentSimulation } from "./SimulationCard";

interface DestroySimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  destroyTarget: PersistentSimulation | null;
  onSuccess: () => void;
}

export function DestroySimulationModal({
  isOpen,
  onClose,
  destroyTarget,
  onSuccess,
}: DestroySimulationModalProps) {
  const [selectedDeploymentId, setSelectedDeploymentId] = useState("");
  const [destroyCreds, setDestroyCreds] = useState({ accessKeyId: "", secretAccessKey: "", sessionToken: "" });
  const [destroyAzureCreds, setDestroyAzureCreds] = useState({ tenantId: "", subscriptionId: "", clientId: "", clientSecret: "" });
  const [destroyGcpCreds, setDestroyGcpCreds] = useState({ projectId: "", clientEmail: "", privateKey: "" });
  const [destroyGcpJsonPaste, setDestroyGcpJsonPaste] = useState("");
  const [destroyCredentialSelection, setDestroyCredentialSelection] = useState<CredentialSelection>({ mode: "manual" });

  const [destroyError, setDestroyError] = useState<string | null>(null);
  const [destroySessionId, setDestroySessionId] = useState<string | null>(null);
  const [destroyLogs, setDestroyLogs] = useState<string[]>([]);
  const [destroyStatus, setDestroyStatus] = useState<"idle" | "running" | "complete" | "failed">("idle");
  const [isRequestPending, setIsRequestPending] = useState(false);
  const seenDestroyLogLinesRef = useRef<Set<string>>(new Set());

  const activeDeployments = (() => {
    if (!destroyTarget) return [];
    const activeDeps = destroyTarget.deployments?.filter((d) => d.status === "active") || [];
    if (activeDeps.length > 0) return activeDeps;
    return destroyTarget.status === "active"
      ? [{ deploymentId: "legacy", label: "Legacy deployment", status: "active" as const, provider: destroyTarget.provider, region: destroyTarget.region, createdAt: destroyTarget.createdAt }]
      : [];
  })();

  const selectedDeployment = activeDeployments.find((d) => d.deploymentId === selectedDeploymentId);
  const destroyProvider = selectedDeployment?.provider || destroyTarget?.provider || "aws";
  const destroyProviderLabel = destroyProvider === "azure" ? "Azure" : destroyProvider === "gcp" ? "GCP" : "AWS";

  // Initialize selected deployment and credentials on target load
  useEffect(() => {
    if (isOpen && destroyTarget) {
      const activeDeps = destroyTarget.deployments?.filter((d) => d.status === "active") || [];
      const firstId = activeDeps[0]?.deploymentId || (destroyTarget.status === "active" ? "legacy" : "");
      setSelectedDeploymentId(firstId);
      setDestroyCreds({ accessKeyId: "", secretAccessKey: "", sessionToken: "" });
      setDestroyAzureCreds({ tenantId: "", subscriptionId: "", clientId: "", clientSecret: "" });
      setDestroyGcpCreds({ projectId: "", clientEmail: "", privateKey: "" });
      setDestroyGcpJsonPaste("");
      
      const targetProvider = activeDeps[0]?.provider || destroyTarget.provider || "aws";
      setDestroyCredentialSelection(targetProvider === "azure" || targetProvider === "gcp"
        ? { mode: "saved", credentialVaultId: "saved", userPresenceVerified: true }
        : { mode: "manual" });

      setDestroyError(null);
      setDestroySessionId(null);
      setDestroyLogs([]);
      seenDestroyLogLinesRef.current.clear();
      setDestroyStatus("idle");
      setIsRequestPending(false);

      void logSimulationAction({
        actionId: "simulation-destroy-modal-opened",
        displayName: `Opened destroy workflow: ${destroyTarget.name}`,
        status: "created",
        region: destroyTarget.region,
        simulationId: destroyTarget._id,
        simulationName: destroyTarget.name,
        target: { resourceId: destroyTarget._id, resourceName: destroyTarget.name },
        metadata: { activeDeployments: activeDeps.length, provider: destroyTarget.provider || "aws" },
      });
    }
  }, [isOpen, destroyTarget]);

  const handleDestroyGcpJsonPaste = (value: string) => {
    setDestroyGcpJsonPaste(value);
    if (!value.trim()) return;
    try {
      const parsed = JSON.parse(value);
      if (parsed.project_id || parsed.client_email || parsed.private_key) {
        setDestroyGcpCreds({
          projectId: parsed.project_id || "",
          clientEmail: parsed.client_email || "",
          privateKey: parsed.private_key || "",
        });
        setDestroyCredentialSelection({ mode: "manual" });
      }
    } catch {
      // Ignore invalid JSON
    }
  };

  const appendDestroyLog = useCallback((line: string) => {
    const trimmed = line.trim();
    if (!trimmed || seenDestroyLogLinesRef.current.has(trimmed)) return;
    seenDestroyLogLinesRef.current.add(trimmed);
    setDestroyLogs((prev) => [...prev, trimmed]);
  }, []);

  const checkDestroyStatus = useCallback(async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/deployment/${sessionId}/status`);
      const data = await res.json();

      if (data.logs && data.logs.length > 0) {
        for (const log of data.logs) {
          appendDestroyLog(typeof log === "string" ? log : (log.line || String(log)));
        }
      }

      if (data.status === "complete") {
        setDestroyStatus("complete");
        setIsRequestPending(false);
        if (destroyTarget) {
          void logSimulationAction({
            actionId: "simulation-deployment-destroyed",
            displayName: `Destroyed deployment: ${destroyTarget.name}`,
            status: "completed",
            region: destroyTarget.region,
            simulationId: destroyTarget._id,
            simulationName: destroyTarget.name,
            target: { resourceId: selectedDeploymentId, resourceName: destroyTarget.name },
            metadata: { destroySessionId: sessionId, provider: destroyTarget.provider || "aws" },
          });
        }
        onSuccess();
      } else if (data.status === "failed" || data.status === "timed_out" || data.status === "cancelled") {
        setDestroyStatus("failed");
        setIsRequestPending(false);
        setDestroyError(data.errorMessage || "Destroy failed");
        if (destroyTarget) {
          void logSimulationAction({
            actionId: "simulation-deployment-destroy-failed",
            displayName: `Destroy failed: ${destroyTarget.name}`,
            status: "failed",
            region: destroyTarget.region,
            simulationId: destroyTarget._id,
            simulationName: destroyTarget.name,
            target: { resourceId: selectedDeploymentId, resourceName: destroyTarget.name },
            reasoning: data.errorMessage || "Destroy failed",
            metadata: { destroySessionId: sessionId, status: data.status, provider: destroyTarget.provider || "aws" },
          });
        }
      } else {
        setTimeout(() => checkDestroyStatus(sessionId), 3000);
      }
    } catch {
      setTimeout(() => checkDestroyStatus(sessionId), 3000);
    }
  }, [appendDestroyLog, destroyTarget, selectedDeploymentId, onSuccess]);

  const handleDestroySimulation = async () => {
    if (!destroyTarget || !selectedDeploymentId) return;
    setIsRequestPending(true);
    setDestroyError(null);
    setDestroyLogs([]);
    seenDestroyLogLinesRef.current.clear();
    setDestroyStatus("running");
    try {
      const credentialPayload =
        destroyProvider === "azure"
          ? destroyCredentialSelection.mode === "saved" && destroyCredentialSelection.credentialVaultId
            ? {
                provider: "azure",
                credentialVaultId: destroyCredentialSelection.credentialVaultId,
                userPresenceVerified: destroyCredentialSelection.userPresenceVerified === true,
              }
            : {
                provider: "azure",
                tenantId: destroyAzureCreds.tenantId,
                subscriptionId: destroyAzureCreds.subscriptionId,
                clientId: destroyAzureCreds.clientId,
                clientSecret: destroyAzureCreds.clientSecret,
              }
          : destroyProvider === "gcp"
          ? destroyCredentialSelection.mode === "saved" && destroyCredentialSelection.credentialVaultId
            ? {
                provider: "gcp",
                credentialVaultId: destroyCredentialSelection.credentialVaultId,
                userPresenceVerified: destroyCredentialSelection.userPresenceVerified === true,
              }
            : {
                provider: "gcp",
                projectId: destroyGcpCreds.projectId,
                clientEmail: destroyGcpCreds.clientEmail,
                privateKey: destroyGcpCreds.privateKey,
              }
          : destroyCredentialSelection.mode === "saved" && destroyCredentialSelection.credentialVaultId
          ? {
              provider: "aws",
              credentialVaultId: destroyCredentialSelection.credentialVaultId,
              userPresenceVerified: destroyCredentialSelection.userPresenceVerified === true,
            }
          : {
              provider: "aws",
              accessKeyId: destroyCreds.accessKeyId,
              secretAccessKey: destroyCreds.secretAccessKey,
              sessionToken: destroyCreds.sessionToken,
            };
      const res = await authFetch(`/api/simulations/${destroyTarget._id}/destroy`, {
        method: "POST",
        body: JSON.stringify({
          deploymentId: selectedDeploymentId,
          ...credentialPayload,
          region: selectedDeployment?.region || destroyTarget.region,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to destroy simulation");
      setDestroySessionId(data.destroySessionId);
      void logSimulationAction({
        actionId: "simulation-deployment-destroy-started",
        displayName: `Started destroy: ${destroyTarget.name}`,
        status: "executing",
        region: selectedDeployment?.region || destroyTarget.region,
        simulationId: destroyTarget._id,
        simulationName: destroyTarget.name,
        target: { resourceId: selectedDeploymentId, resourceName: selectedDeployment?.label || destroyTarget.name },
        metadata: { destroySessionId: data.destroySessionId, provider: destroyTarget.provider || "aws" },
      });
    } catch (err: any) {
      setDestroyError(err.message || "Failed to destroy simulation");
      setDestroyStatus("failed");
      setIsRequestPending(false);
      void logSimulationAction({
        actionId: "simulation-deployment-destroy-failed",
        displayName: `Destroy failed: ${destroyTarget.name}`,
        status: "failed",
        region: destroyTarget.region,
        simulationId: destroyTarget._id,
        simulationName: destroyTarget.name,
        target: { resourceId: selectedDeploymentId, resourceName: destroyTarget.name },
        reasoning: err.message || "Failed to destroy simulation",
        metadata: { provider: destroyTarget.provider || "aws" },
      });
    }
  };

  useEffect(() => {
    if (!destroySessionId) return;

    const token = getAuthToken();
    if (!token) {
      setDestroyStatus("failed");
      setIsRequestPending(false);
      setDestroyError("You need to sign in again before streaming destroy logs.");
      return;
    }

    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      // SSE/EventSource is not supported on AWS Amplify/API Gateway, fall back directly to polling.
      checkDestroyStatus(destroySessionId);
      return;
    }

    const es = new EventSource(buildApiUrl(`/api/deployment/${destroySessionId}/stream?token=${encodeURIComponent(token)}`));

    es.addEventListener("log", (event) => {
      try {
        const data = JSON.parse(event.data);
        const line = typeof data?.line === "string" ? data.line : event.data;
        appendDestroyLog(line);
      } catch {
        appendDestroyLog(event.data);
      }
    });

    es.addEventListener("status", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "running") setDestroyStatus("running");
        if (data.status === "complete") setDestroyStatus("complete");
        if (data.status === "failed" || data.status === "timed_out" || data.status === "cancelled") {
          setDestroyStatus("failed");
          setIsRequestPending(false);
          setDestroyError(data.error || "Destroy failed");
          if (destroyTarget) {
            void logSimulationAction({
              actionId: "simulation-deployment-destroy-failed",
              displayName: `Destroy failed: ${destroyTarget.name}`,
              status: "failed",
              region: destroyTarget.region,
              simulationId: destroyTarget._id,
              simulationName: destroyTarget.name,
              target: { resourceId: selectedDeploymentId, resourceName: destroyTarget.name },
              reasoning: data.error || "Destroy failed",
              metadata: { destroySessionId, status: data.status, provider: destroyTarget.provider || "aws" },
            });
          }
        }
      } catch {
        // Status events are best-effort
      }
    });

    es.addEventListener("complete", async () => {
      setDestroyStatus("complete");
      setIsRequestPending(false);
      if (destroyTarget) {
        void logSimulationAction({
          actionId: "simulation-deployment-destroyed",
          displayName: `Destroyed deployment: ${destroyTarget.name}`,
          status: "completed",
          region: destroyTarget.region,
          simulationId: destroyTarget._id,
          simulationName: destroyTarget.name,
          target: { resourceId: selectedDeploymentId, resourceName: destroyTarget.name },
          metadata: { destroySessionId, provider: destroyTarget.provider || "aws" },
        });
      }
      onSuccess();
      es.close();
    });

    es.addEventListener("failed", (event) => {
      setDestroyStatus("failed");
      setIsRequestPending(false);
      try {
        const data = JSON.parse(event.data);
        setDestroyError(data.error || "Destroy failed");
        if (destroyTarget) {
          void logSimulationAction({
            actionId: "simulation-deployment-destroy-failed",
            displayName: `Destroy failed: ${destroyTarget.name}`,
            status: "failed",
            region: destroyTarget.region,
            simulationId: destroyTarget._id,
            simulationName: destroyTarget.name,
            target: { resourceId: selectedDeploymentId, resourceName: destroyTarget.name },
            reasoning: data.error || "Destroy failed",
            metadata: { destroySessionId, provider: destroyTarget.provider || "aws" },
          });
        }
      } catch {
        setDestroyError("Destroy failed");
      }
      es.close();
    });

    es.onerror = (event: any) => {
      if (typeof event?.data === "string") {
        try {
          const data = JSON.parse(event.data);
          setDestroyStatus("failed");
          setIsRequestPending(false);
          setDestroyError(data.error || "Destroy log stream failed");
          es.close();
          return;
        } catch {
          // fallback to polling
        }
      }
      es.close();
      checkDestroyStatus(destroySessionId);
    };

    return () => {
      es.close();
    };
  }, [destroySessionId, onSuccess, appendDestroyLog, checkDestroyStatus, destroyTarget, selectedDeploymentId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && destroyStatus !== "running" && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden border-red-500/20 bg-card/98 backdrop-blur-xl shadow-2xl rounded-2xl">
        <DialogHeader className="relative overflow-hidden pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400">
              <AlertTriangle className="h-5.5 w-5.5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Destroy Deployment</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Choose one active deployment from this canvas. This will permanently terminate its cloud resources.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="w-full min-w-0 space-y-5 pt-4 animate-none">
          <div className="rounded-xl bg-muted/40 p-4 border border-border/50 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Select Active Deployment
            </label>
            <select
              value={selectedDeploymentId}
              onChange={(event) => setSelectedDeploymentId(event.target.value)}
              disabled={destroyStatus === "running"}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 focus:outline-none transition-all"
            >
              {activeDeployments.map((deployment, index) => (
                <option key={`${deployment.deploymentId}-${index}`} value={deployment.deploymentId}>
                  {deployment.label || deployment.deploymentId} - {deployment.region}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3.5">
            {destroyProvider === "azure" ? (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row rounded-lg bg-muted p-1 gap-1 sm:gap-0">
                    <button
                      type="button"
                      onClick={() => setDestroyCredentialSelection({ mode: "saved", credentialVaultId: "saved", userPresenceVerified: true })}
                      disabled={destroyStatus === "running"}
                      className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold transition-all duration-200 ${destroyCredentialSelection.mode === "saved" ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Saved Azure Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestroyCredentialSelection({ mode: "manual" })}
                      disabled={destroyStatus === "running"}
                      className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold transition-all duration-200 ${destroyCredentialSelection.mode === "manual" ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Manual Credentials
                    </button>
                  </div>
                  {destroyCredentialSelection.mode === "saved" && (
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 bg-muted/50 p-2.5 rounded-lg border border-border/30">
                      <Key className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      Uses the Azure connection configured in Settings &gt; Azure.
                    </p>
                  )}
                </div>
                {destroyCredentialSelection.mode === "manual" && (
                  <div className="grid gap-3.5 bg-muted/20 p-3.5 rounded-xl border border-border/40">
                    <Input
                      value={destroyAzureCreds.tenantId}
                      onChange={(event) => setDestroyAzureCreds((prev) => ({ ...prev, tenantId: event.target.value }))}
                      placeholder="Azure Tenant ID"
                      disabled={destroyStatus === "running"}
                      className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                    />
                    <Input
                      value={destroyAzureCreds.subscriptionId}
                      onChange={(event) => setDestroyAzureCreds((prev) => ({ ...prev, subscriptionId: event.target.value }))}
                      placeholder="Azure Subscription ID"
                      disabled={destroyStatus === "running"}
                      className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                    />
                    <Input
                      value={destroyAzureCreds.clientId}
                      onChange={(event) => setDestroyAzureCreds((prev) => ({ ...prev, clientId: event.target.value }))}
                      placeholder="Azure Client ID"
                      disabled={destroyStatus === "running"}
                      className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                    />
                    <Input
                      value={destroyAzureCreds.clientSecret}
                      onChange={(event) => setDestroyAzureCreds((prev) => ({ ...prev, clientSecret: event.target.value }))}
                      placeholder="Azure Client Secret"
                      type="password"
                      disabled={destroyStatus === "running"}
                      className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                    />
                  </div>
                )}
              </>
            ) : destroyProvider === "gcp" ? (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row rounded-lg bg-muted p-1 gap-1 sm:gap-0">
                    <button
                      type="button"
                      onClick={() => setDestroyCredentialSelection({ mode: "saved", credentialVaultId: "saved", userPresenceVerified: true })}
                      disabled={destroyStatus === "running"}
                      className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold transition-all duration-200 ${destroyCredentialSelection.mode === "saved" ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Saved GCP Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestroyCredentialSelection({ mode: "manual" })}
                      disabled={destroyStatus === "running"}
                      className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold transition-all duration-200 ${destroyCredentialSelection.mode === "manual" ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Manual Credentials
                    </button>
                  </div>
                  {destroyCredentialSelection.mode === "saved" && (
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 bg-muted/50 p-2.5 rounded-lg border border-border/30">
                      <Key className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      Uses the GCP connection configured in Settings &gt; GCP.
                    </p>
                  )}
                </div>
                {destroyCredentialSelection.mode === "manual" && (
                  <div className="grid gap-3.5 bg-muted/20 p-3.5 rounded-xl border border-border/40 animate-none">
                    <textarea
                      value={destroyGcpJsonPaste}
                      onChange={(event) => handleDestroyGcpJsonPaste(event.target.value)}
                      placeholder="Paste GCP Service Account JSON Key here to auto-populate fields..."
                      disabled={destroyStatus === "running"}
                      className="h-20 w-full rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 focus:outline-none transition-all"
                    />
                    <Input
                      value={destroyGcpCreds.projectId}
                      onChange={(event) => setDestroyGcpCreds((prev) => ({ ...prev, projectId: event.target.value }))}
                      placeholder="GCP Project ID"
                      disabled={destroyStatus === "running"}
                      className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                    />
                    <Input
                      value={destroyGcpCreds.clientEmail}
                      onChange={(event) => setDestroyGcpCreds((prev) => ({ ...prev, clientEmail: event.target.value }))}
                      placeholder="Service Account Client Email"
                      disabled={destroyStatus === "running"}
                      className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                    />
                    <textarea
                      value={destroyGcpCreds.privateKey}
                      onChange={(event) => setDestroyGcpCreds((prev) => ({ ...prev, privateKey: event.target.value }))}
                      placeholder="GCP Private Key (-----BEGIN PRIVATE KEY-----...)"
                      disabled={destroyStatus === "running"}
                      className="h-24 w-full rounded-lg border border-border/80 bg-background/80 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 focus:outline-none transition-all"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="grid gap-3.5 bg-muted/20 p-3.5 rounded-xl border border-border/40">
                <AwsCredentialVaultPicker
                  region={selectedDeployment?.region || destroyTarget?.region || "us-east-1"}
                  accessKeyId={destroyCreds.accessKeyId}
                  secretAccessKey={destroyCreds.secretAccessKey}
                  sessionToken={destroyCreds.sessionToken}
                  disabled={destroyStatus === "running"}
                  selection={destroyCredentialSelection}
                  onSelectionChange={setDestroyCredentialSelection}
                />
                <Input
                  value={destroyCreds.accessKeyId}
                  onChange={(event) => {
                    setDestroyCreds((prev) => ({ ...prev, accessKeyId: event.target.value }));
                    setDestroyCredentialSelection({ mode: "manual" });
                  }}
                  placeholder="AWS Access Key ID"
                  disabled={destroyStatus === "running"}
                  className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                />
                <Input
                  value={destroyCreds.secretAccessKey}
                  onChange={(event) => {
                    setDestroyCreds((prev) => ({ ...prev, secretAccessKey: event.target.value }));
                    setDestroyCredentialSelection({ mode: "manual" });
                  }}
                  placeholder="AWS Secret Access Key"
                  type="password"
                  disabled={destroyStatus === "running"}
                  className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                />
                <Input
                  value={destroyCreds.sessionToken}
                  onChange={(event) => {
                    setDestroyCreds((prev) => ({ ...prev, sessionToken: event.target.value }));
                    setDestroyCredentialSelection({ mode: "manual" });
                  }}
                  placeholder="Session Token (optional)"
                  disabled={destroyStatus === "running"}
                  className="bg-background/80 border-border/80 focus:border-red-500/50 focus:ring-red-500/20"
                />
              </div>
            )}
          </div>
          {(destroyStatus !== "idle" || destroyLogs.length > 0) && (
            <div className="w-full min-w-0 overflow-hidden rounded-xl border border-zinc-800/80 bg-[#0b0f19] text-slate-100 shadow-lg shadow-black/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-[#0d1321] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-500/70" />
                    <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                    <span className="h-3 w-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-400 font-mono">
                    <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                    terraform-destroy.log
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    destroyStatus === "complete"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold"
                      : destroyStatus === "failed"
                        ? "border-red-500/30 bg-red-500/10 text-red-400 font-bold"
                        : "border-sky-500/30 bg-sky-500/10 text-sky-400 font-bold animate-pulse"
                  }
                >
                  {destroyStatus === "complete" ? "SUCCESS" : destroyStatus === "failed" ? "FAILED" : "DESTROYING"}
                </Badge>
              </div>
              <ScrollArea className="h-52 w-full bg-black/60">
                <div className="w-full min-w-0 space-y-1.5 p-4 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {destroyLogs.length === 0 ? (
                    <div className="flex items-center gap-2 text-zinc-500 italic">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Initializing Docker runner and executing Terraform...
                    </div>
                  ) : (
                    destroyLogs.map((line, index) => (
                      <p key={`${index}-${line}`} className="w-full min-w-0 max-w-full overflow-x-hidden whitespace-pre-wrap break-all border-l-2 border-transparent pl-2 hover:border-zinc-800 hover:bg-white/5 transition-all">
                        {line}
                      </p>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
          {destroyError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs font-semibold text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{destroyError}</span>
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-border/50 pt-4 gap-2 sm:gap-0">
          <Button
            variant={destroyStatus === "complete" ? "default" : "outline"}
            onClick={onClose}
            disabled={destroyStatus === "running"}
            className={
              destroyStatus === "complete"
                ? "w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white dark:bg-emerald-700 dark:hover:bg-emerald-800 font-bold active:scale-[0.98] transition-all shadow-md shadow-emerald-600/10 dark:shadow-emerald-950/20"
                : "rounded-xl border-border/80 hover:bg-muted/80 text-foreground"
            }
          >
            {destroyStatus === "complete" ? "Close" : "Cancel"}
          </Button>
          {destroyStatus !== "complete" && (
            <Button
              onClick={handleDestroySimulation}
              disabled={
                !selectedDeploymentId ||
                (destroyProvider === "azure"
                  ? destroyCredentialSelection.mode === "saved"
                    ? !destroyCredentialSelection.credentialVaultId || destroyCredentialSelection.userPresenceVerified !== true
                    : !destroyAzureCreds.tenantId || !destroyAzureCreds.subscriptionId || !destroyAzureCreds.clientId || !destroyAzureCreds.clientSecret
                  : destroyProvider === "gcp"
                    ? destroyCredentialSelection.mode === "saved"
                      ? !destroyCredentialSelection.credentialVaultId || destroyCredentialSelection.userPresenceVerified !== true
                      : !destroyGcpCreds.projectId || !destroyGcpCreds.clientEmail || !destroyGcpCreds.privateKey
                    : destroyCredentialSelection.mode === "saved"
                      ? !destroyCredentialSelection.credentialVaultId || destroyCredentialSelection.userPresenceVerified !== true
                      : !destroyCreds.accessKeyId || !destroyCreds.secretAccessKey) ||
                destroyStatus === "running" ||
                isRequestPending
              }
              className="rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white dark:bg-red-700 dark:hover:bg-red-800 shadow-lg shadow-red-600/10 dark:shadow-red-950/20 active:scale-[0.98] transition-all duration-200 gap-2 font-bold whitespace-normal h-auto py-2.5"
            >
              {destroyStatus === "running" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Destroying...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Terminate {destroyProviderLabel} Deployment
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
