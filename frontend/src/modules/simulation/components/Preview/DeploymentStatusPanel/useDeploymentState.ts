"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiClientError,
  authFetch,
  buildApiUrl,
  getAuthToken,
} from "@/lib/auth-fetch";
import type { CredentialSelection } from "@/lib/aws-credential-vault";
import { logSimulationAction } from "@/lib/simulation-action-log";
import {
  buildDeploymentPresentation,
  maskDeploymentId,
  type DeploymentPhase,
} from "./deploymentPresentation";
import {
  buildCredentialPayload,
  canValidateDeploymentCredentials,
} from "./deploymentCredentials";
import { buildRegistryDeploymentState } from "./registryDeployment";
import {
  buildDeploymentStageStatuses,
  isStage2StartLine,
} from "./deploymentStageStatus";
import type { AccountInfo, UseDeploymentStateProps } from "./deploymentStateTypes";
import {
  applyGcpServiceAccountPaste,
  copyDeploymentLogs,
  resolveDeploymentSshKeyName,
} from "./deploymentStateHelpers";
import {
  appendDeploymentStatusLogs,
  closeDeploymentStreams,
  isFailedDeploymentStatus,
  readDeploymentEventLine,
  scheduleSuccessStatusChecks,
  shouldFinalizeAfterUploadPause,
} from "./deploymentStreamHelpers";

type Phase = DeploymentPhase;

export function useDeploymentState({
  nodes = [],
  edges = [],
  region,
  draftId = null,
  name = "simulation",
  provider,
  onClose,
  deploymentId: initialDeploymentId,
  action = "deploy",
  resourceLabel = "resources",
  service,
  resourceId,
  mode = "simulation",
  onDeploymentIdChange,
}: UseDeploymentStateProps) {
  const [phase, setPhase] = useState<Phase>("creds");
  const [deploymentId, setDeploymentId] = useState<string | null>(
    mode === "live-action" && initialDeploymentId ? initialDeploymentId : null,
  );
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [containerId, setContainerId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, any>>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seenLogLinesRef = useRef<Set<string>>(new Set());
  const terminalLoggedRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const terminalPhaseRef = useRef<"complete" | "failed" | null>(null);
  const runnerReportedSuccessRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Form states
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [gcpJsonPaste, setGcpJsonPaste] = useState("");
  const [showAdvancedGcp, setShowAdvancedGcp] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const isResumingRef = useRef(false);

  const [formRegion, setFormRegion] = useState(region);
  const [regionLocked, setRegionLocked] = useState(false);
  const [credentialSelection, setCredentialSelection] =
    useState<CredentialSelection>({ mode: "manual" });

  const [activeTab, setActiveTab] = useState<"instructions" | "logs" | "outputs">("logs");
  const [showCredsUpdate, setShowCredsUpdate] = useState(false);
  const [copiedUrls, setCopiedUrls] = useState<Record<string, boolean>>({});

  const handleCopyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrls((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedUrls((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };
  const [hasPausedForUpload, setHasPausedForUpload] = useState(false);
  const hasPausedForUploadRef = useRef(hasPausedForUpload);
  useEffect(() => {
    hasPausedForUploadRef.current = hasPausedForUpload;
  }, [hasPausedForUpload]);

  const seenStage2StartRef = useRef(false);

  const {
    ecrOutputs,
    hasEcr,
    registryLabel,
    scriptFilePrefix,
    downloadBashScript,
    downloadPowerShellScript,
  } = buildRegistryDeploymentState({
    outputs,
    nodes,
    provider,
    name,
    formRegion,
  });

  useEffect(() => {
    if (phase === "awaiting_image_upload") {
      setHasPausedForUpload(true);
      if (hasEcr) {
        setActiveTab("instructions");
      } else {
        setActiveTab("logs");
      }
    } else if (phase === "complete" || phase === "failed") {
      setActiveTab("outputs");
    } else if (phase === "running") {
      setActiveTab("logs");
    }
  }, [phase, hasEcr]);

  const { stage1Status, stage2Status, stage3Status } =
    buildDeploymentStageStatuses(phase, hasPausedForUpload);

  useEffect(() => {
    onDeploymentIdChange?.(deploymentId);
  }, [deploymentId, onDeploymentIdChange]);

  useEffect(() => {
    if (provider === "azure" || provider === "gcp") {
      setCredentialSelection({
        mode: "saved",
        credentialVaultId: "saved",
        userPresenceVerified: true,
      });
    } else {
      setCredentialSelection({ mode: "manual" });
    }
  }, [provider]);

  const credentialPayload = buildCredentialPayload({
    provider,
    credentialSelection,
    formRegion,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    tenantId,
    subscriptionId,
    clientId,
    clientSecret,
    projectId,
    clientEmail,
    privateKey,
  });

  const isGcpKeyConfigured = !!(projectId && clientEmail && privateKey);

  const canValidateCredentials = canValidateDeploymentCredentials({
    provider,
    credentialSelection,
    formRegion,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    tenantId,
    subscriptionId,
    clientId,
    clientSecret,
    projectId,
    clientEmail,
    privateKey,
  });

  const startSession = useCallback(async () => {
    setPhase("starting");
    setError(null);
    setHasPausedForUpload(false);
    seenStage2StartRef.current = false;

    try {
      const res = await authFetch("/api/deployment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            serviceId: n.data?.serviceId,
            config: n.data?.config,
            label: n.data?.label,
            data: {
              id: n.data?.id,
              serviceId: n.data?.serviceId,
              config: n.data?.config,
              label: n.data?.label,
            },
          })),
          edges,
          region,
          name,
          draftId,
        }),
      });
      const data = await res.json();
      setDeploymentId(data.deploymentId);
      void logSimulationAction({
        actionId: "simulation-deployment-prepared",
        displayName: "Prepared simulation deployment",
        status: "created",
        region,
        simulationId: draftId,
        simulationName: name,
        target: { resourceId: data.deploymentId, resourceName: name },
        metadata: { nodeCount: nodes.length, edgeCount: edges.length },
      });
      setPhase("creds");
    } catch (err: any) {
      setError(err.message || "Failed to start deployment session");
      setPhase("failed");
    }
  }, [nodes, edges, region, name, draftId]);

  const handleValidateCreds = useCallback(async () => {
    setPhase("validating");
    setError(null);

    try {
      const validateRes = await authFetch("/api/deployment/validate-creds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentialPayload),
      });
      const validateData = await validateRes.json();

      if (validateData.success) {
        const info: AccountInfo = {
          accountId: validateData.accountId,
          arn: validateData.arn,
        };
        setAccountInfo(info);
        setRegionLocked(true);
        setPhase("validated");

        void logSimulationAction({
          actionId:
            mode === "live-action"
              ? "live-action-credentials-validated"
              : "simulation-credentials-validated",
          displayName:
            mode === "live-action"
              ? `Validated credentials for live ${action}: ${resourceLabel}`
              : `Validated ${provider === "azure" ? "Azure" : provider === "gcp" ? "GCP" : "AWS"} credentials for simulation deployment`,
          region: formRegion,
          simulationId: mode === "simulation" ? draftId : undefined,
          simulationName: mode === "simulation" ? name : undefined,
          target:
            mode === "live-action"
              ? {
                  resourceId: resourceId || deploymentId || "",
                  resourceName: resourceLabel,
                }
              : undefined,
          metadata:
            mode === "live-action"
              ? {
                  action,
                  service,
                  deploymentId,
                  accountId: validateData.accountId,
                }
              : { accountId: validateData.accountId },
        });
      } else {
        setError(validateData.error || "Invalid credentials");
        setPhase("creds");
      }
    } catch (err: any) {
      if (!(err instanceof ApiClientError && err.status === 400)) {
        console.error("[deployment] Validation error:", err);
      }
      setError(
        err.message ||
          (provider === "azure"
            ? "Invalid credentials. Please check the Tenant ID, Subscription ID, Client ID, Client Secret, and region."
            : provider === "gcp"
              ? "Invalid credentials. Please check the project ID, service account email, private key, and region."
              : "Invalid credentials. Please check the access key, secret key, session token, and region."),
      );
      setPhase("creds");
    }
  }, [
    credentialPayload,
    formRegion,
    draftId,
    name,
    provider,
    mode,
    action,
    resourceId,
    deploymentId,
    resourceLabel,
    service,
  ]);

  const handleDownloadPem = useCallback(async () => {
    if (!deploymentId) return;
    try {
      const token = getAuthToken();
      if (!token) {
        setError("You need to sign in again before downloading the PEM key.");
        return;
      }

      const url = buildApiUrl(
        `/api/deployment/${deploymentId}/download-pem?token=${encodeURIComponent(token)}`,
      );

      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download PEM:", err);
    }
  }, [deploymentId]);

  const appendLogLine = useCallback((line: string) => {
    const trimmed = line.trim();
    if (!trimmed || seenLogLinesRef.current.has(trimmed)) return;
    seenLogLinesRef.current.add(trimmed);
    setLogs((prev) => [...prev, trimmed]);
  }, []);

  const markComplete = useCallback(() => {
    if (terminalPhaseRef.current === "failed") return;
    if (phaseRef.current === "awaiting_image_upload") return;
    terminalPhaseRef.current = "complete";
    setPhase("complete");
  }, []);

  const markFailed = useCallback((message?: string) => {
    if (terminalPhaseRef.current === "complete") return;
    terminalPhaseRef.current = "failed";
    setPhase("failed");
    setError(message || "Deployment failed");
  }, []);

  const connectSSE = useCallback(
    (depId: string) => {
      const token = getAuthToken();
      if (!token) {
        setError("You need to sign in again before streaming deployment logs.");
        markFailed(
          "You need to sign in again before streaming deployment logs.",
        );
        return;
      }

      const isDev = process.env.NODE_ENV === "development";
      if (!isDev) {
        // SSE/EventSource is not supported on AWS Amplify/API Gateway, fall back directly to polling.
        closeDeploymentStreams(eventSourceRef, pollingTimeoutRef);
        seenStage2StartRef.current = !hasPausedForUploadRef.current;
        pollingTimeoutRef.current = setTimeout(() => {
          checkStatus(depId);
        }, 100);
        return;
      }

      const url = buildApiUrl(
        `/api/deployment/${depId}/stream?token=${encodeURIComponent(token)}`,
      );

      closeDeploymentStreams(eventSourceRef, pollingTimeoutRef);

      seenStage2StartRef.current = !hasPausedForUploadRef.current;

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("log", (event) => {
        const line = readDeploymentEventLine(event.data);
        if (isStage2StartLine(line)) {
          seenStage2StartRef.current = true;
        }
        appendLogLine(line);
        if (
          line.toLowerCase().includes("[success] deployment complete") &&
          seenStage2StartRef.current
        ) {
          runnerReportedSuccessRef.current = true;
          scheduleSuccessStatusChecks({
            depId,
            checkStatus,
            markComplete,
            terminalPhaseRef,
          });
        }
      });

      es.addEventListener("status", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.containerId) setContainerId(data.containerId);
          if (data.outputs) setOutputs(data.outputs || {});
          if (data.status === "running") setPhase("running");
          if (data.status === "awaiting_image_upload") {
            if (!hasPausedForUploadRef.current) {
              setPhase("awaiting_image_upload");
              runnerReportedSuccessRef.current = false;
            }
          }
          if (isFailedDeploymentStatus(data.status)) {
            markFailed(data.error || "Deployment failed");
            if (!terminalLoggedRef.current) {
              terminalLoggedRef.current = true;
              void logSimulationAction({
                actionId:
                  mode === "live-action"
                    ? "live-action-failed"
                    : "simulation-deployment-failed",
                displayName:
                  mode === "live-action"
                    ? `Failed live ${action}: ${resourceLabel}`
                    : `Deployment failed: ${name}`,
                status: "failed",
                region: formRegion,
                simulationId: mode === "simulation" ? draftId : undefined,
                simulationName: mode === "simulation" ? name : undefined,
                target: {
                  resourceId: depId,
                  resourceName: mode === "live-action" ? resourceLabel : name,
                },
                reasoning: data.error || "Deployment failed",
                metadata:
                  mode === "live-action"
                    ? { action, service, deploymentId: depId }
                    : { status: data.status },
              });
            }
          }
          if (data.status === "complete") {
            if (
              shouldFinalizeAfterUploadPause(
                hasPausedForUploadRef.current,
                seenStage2StartRef.current,
              )
            ) {
              markComplete();
            }
          }
        } catch {
          // Fallback status
        }
      });

      es.addEventListener("complete", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.outputs) setOutputs(data.outputs || {});
        } catch {
          // Status polling will hydrate outputs if the stream payload is unavailable.
        }
        if (
          shouldFinalizeAfterUploadPause(
            hasPausedForUploadRef.current,
            seenStage2StartRef.current,
          )
        ) {
          markComplete();
        }
        eventSourceRef.current = null;
        es.close();
      });

      es.addEventListener("failed", (event) => {
        try {
          const data = JSON.parse(event.data);
          markFailed(data.error || "Deployment failed");
          if (!terminalLoggedRef.current) {
            terminalLoggedRef.current = true;
            void logSimulationAction({
              actionId:
                mode === "live-action"
                  ? "live-action-failed"
                  : "simulation-deployment-failed",
              displayName:
                mode === "live-action"
                  ? `Failed live ${action}: ${resourceLabel}`
                  : `Deployment failed: ${name}`,
              status: "failed",
              region: formRegion,
              simulationId: mode === "simulation" ? draftId : undefined,
              simulationName: mode === "simulation" ? name : undefined,
              target: {
                resourceId: depId,
                resourceName: mode === "live-action" ? resourceLabel : name,
              },
              reasoning: data.error || "Deployment failed",
              metadata:
                mode === "live-action"
                  ? { action, service, deploymentId: depId }
                  : undefined,
            });
          }
        } catch {
          markFailed("Deployment failed");
        }
        eventSourceRef.current = null;
        es.close();
      });

      es.onerror = (event: any) => {
        if (typeof event?.data === "string") {
          try {
            const data = JSON.parse(event.data);
            markFailed(data.error || "Deployment log stream failed");
            eventSourceRef.current = null;
            es.close();
            return;
          } catch {
            // Poll below
          }
        }
        es.close();
        eventSourceRef.current = null;
        checkStatus(depId);
      };
    },
    [
      appendLogLine,
      draftId,
      formRegion,
      markComplete,
      markFailed,
      name,
      mode,
      action,
      resourceLabel,
      service,
    ],
  );

  const handleDeploy = useCallback(async () => {
    if (!deploymentId) return;
    setPhase("running");
    setError(null);
    setLogs([]);
    seenLogLinesRef.current.clear();
    terminalLoggedRef.current = false;
    terminalPhaseRef.current = null;
    runnerReportedSuccessRef.current = false;

    try {
      const runRes = await authFetch(`/api/deployment/${deploymentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentialPayload),
      });
      const runData = await runRes.json();

      if (!runData.success) {
        setError(runData.error || "Failed to start deployment");
        markFailed(runData.error || "Failed to start deployment");
        return;
      }

      setContainerId(runData.accountId || null);
      void logSimulationAction({
        actionId:
          mode === "live-action"
            ? "live-action-started"
            : "simulation-deployment-started",
        displayName:
          mode === "live-action"
            ? `Started live ${action}: ${resourceLabel}`
            : `Started deployment: ${name}`,
        status: "executing",
        region: formRegion,
        simulationId: mode === "simulation" ? draftId : undefined,
        simulationName: mode === "simulation" ? name : undefined,
        target: {
          resourceId: deploymentId,
          resourceName: mode === "live-action" ? resourceLabel : name,
        },
        metadata:
          mode === "live-action"
            ? { action, service, deploymentId }
            : { nodeCount: nodes.length, edgeCount: edges.length },
      });
      connectSSE(deploymentId);
    } catch (err: any) {
      console.error("[deployment] Run error:", err);
      markFailed(err.message || "Failed to start deployment");
    }
  }, [
    deploymentId,
    credentialPayload,
    connectSSE,
    formRegion,
    draftId,
    markFailed,
    name,
    nodes.length,
    edges.length,
    mode,
    action,
    resourceLabel,
    service,
  ]);

  const handleResume = useCallback(async () => {
    if (!deploymentId || isResumingRef.current) return;
    isResumingRef.current = true;
    setIsResuming(true);
    setError(null);

    closeDeploymentStreams(eventSourceRef, pollingTimeoutRef);

    try {
      const res = await authFetch(`/api/deployment/${deploymentId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentialPayload),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to resume deployment");
        setIsResuming(false);
        isResumingRef.current = false;
        return;
      }

      setPhase("running");
      runnerReportedSuccessRef.current = false;
      seenStage2StartRef.current = false;
      setIsResuming(false);
      isResumingRef.current = false;
      connectSSE(deploymentId);
    } catch (err: any) {
      console.error("[deployment] Resume error:", err);
      setError(err.message || "Failed to resume deployment");
      setIsResuming(false);
      isResumingRef.current = false;
    }
  }, [deploymentId, credentialPayload, connectSSE]);

  const checkStatus = useCallback(
    async (depId: string) => {
      try {
        const res = await authFetch(`/api/deployment/${depId}/status`);
        const data = await res.json();

        appendDeploymentStatusLogs({
          logs: data.logs,
          appendLogLine,
          markStage2Start: () => {
            seenStage2StartRef.current = true;
          },
        });

        if (data.status === "complete") {
          if (
            shouldFinalizeAfterUploadPause(
              hasPausedForUploadRef.current,
              seenStage2StartRef.current,
            )
          ) {
            markComplete();
            setOutputs(data.outputs || {});
          }
        } else if (data.status === "awaiting_image_upload") {
          if (!hasPausedForUploadRef.current) {
            setPhase("awaiting_image_upload");
            setOutputs(data.outputs || {});
            runnerReportedSuccessRef.current = false;
          }
          if (mode === "live-action" && !terminalLoggedRef.current) {
            terminalLoggedRef.current = true;
            void logSimulationAction({
              actionId: "live-action-completed",
              displayName: `Completed live ${action}: ${resourceLabel}`,
              status: "completed",
              region: formRegion,
              target: {
                resourceId: resourceId || depId,
                resourceName: resourceLabel,
              },
              metadata: { action, service, deploymentId: depId },
            });
          }
        } else if (data.status === "failed") {
          markFailed(data.errorMessage || "Deployment failed");
          if (mode === "live-action" && !terminalLoggedRef.current) {
            terminalLoggedRef.current = true;
            void logSimulationAction({
              actionId: "live-action-failed",
              displayName: `Failed live ${action}: ${resourceLabel}`,
              status: "failed",
              region: formRegion,
              target: {
                resourceId: resourceId || depId,
                resourceName: resourceLabel,
              },
              reasoning: data.errorMessage || "Action failed",
              metadata: { action, service, deploymentId: depId },
            });
          }
        } else if (data.status === "cancelled") {
          markFailed("Deployment cancelled");
          if (mode === "live-action" && !terminalLoggedRef.current) {
            terminalLoggedRef.current = true;
            void logSimulationAction({
              actionId: "live-action-failed",
              displayName: `Cancelled live ${action}: ${resourceLabel}`,
              status: "failed",
              region: formRegion,
              target: {
                resourceId: resourceId || depId,
                resourceName: resourceLabel,
              },
              reasoning: "Action cancelled",
              metadata: { action, service, deploymentId: depId },
            });
          }
        } else if (
          !eventSourceRef.current ||
          runnerReportedSuccessRef.current
        ) {
          if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
          pollingTimeoutRef.current = setTimeout(() => checkStatus(depId), 3000);
        }
      } catch {
        if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = setTimeout(() => checkStatus(depId), 3000);
      }
    },
    [
      appendLogLine,
      markComplete,
      markFailed,
      mode,
      action,
      formRegion,
      resourceId,
      resourceLabel,
      service,
    ],
  );

  useEffect(() => {
    if (mode === "live-action" && initialDeploymentId) {
      setDeploymentId(initialDeploymentId);
      setPhase("creds");
    }
  }, [mode, initialDeploymentId]);

  useEffect(() => {
    if (mode === "simulation" && !sessionStartedRef.current) {
      sessionStartedRef.current = true;
      startSession();
    }
  }, [mode, startSession]);

  const hasAutoValidatedRef = useRef(false);
  const hasAutoDeployedRef = useRef(false);

  useEffect(() => {
    if (
      mode === "live-action" &&
      phase === "creds" &&
      credentialSelection.mode === "saved" &&
      (provider === "azure" || provider === "gcp" || provider === "aws")
    ) {
      if (!hasAutoValidatedRef.current) {
        hasAutoValidatedRef.current = true;
        handleValidateCreds();
      }
    }
  }, [mode, phase, credentialSelection.mode, provider, handleValidateCreds]);

  useEffect(() => {
    if (
      mode === "live-action" &&
      phase === "validated" &&
      credentialSelection.mode === "saved" &&
      (provider === "azure" || provider === "gcp" || provider === "aws")
    ) {
      if (!hasAutoDeployedRef.current) {
        hasAutoDeployedRef.current = true;
        handleDeploy();
      }
    }
  }, [mode, phase, credentialSelection.mode, provider, handleDeploy]);

  useEffect(() => {
    if (phase === "complete" && deploymentId) {
      if (mode === "simulation" && !terminalLoggedRef.current) {
        terminalLoggedRef.current = true;
        void logSimulationAction({
          actionId: "simulation-deployment-completed",
          displayName: `Completed deployment: ${name}`,
          status: "completed",
          region: formRegion,
          simulationId: draftId,
          simulationName: name,
          target: { resourceId: deploymentId, resourceName: name },
        });
      }
      checkStatus(deploymentId);
    }
  }, [phase, deploymentId, checkStatus, name, formRegion, draftId, mode]);

  const handleGcpJsonPaste = (value: string) => {
    applyGcpServiceAccountPaste({
      value,
      setGcpJsonPaste,
      setProjectId,
      setClientEmail,
      setPrivateKey,
      setCredentialSelection,
    });
  };

  const handleCopyLogs = () => {
    copyDeploymentLogs({ logs, setCopied });
  };

  const resolveSshKeyName = useCallback(
    (vmInfo: any) => {
      return resolveDeploymentSshKeyName({
        vmInfo,
        outputs,
        provider,
        deploymentId,
        name,
      });
    },
    [deploymentId, name, outputs.key_name, provider],
  );

  const { activeStep, phaseLabel, providerLabel, steps } =
    buildDeploymentPresentation({
      phase,
      mode,
      action,
      provider,
      registryLabel,
    });

  const restartConnection = useCallback(() => {
    setPhase("creds");
    setAccountInfo(null);
    setRegionLocked(false);
    setLogs([]);
    seenLogLinesRef.current.clear();
    setError(null);
    setHasPausedForUpload(false);
  }, []);

  const allowBackdropClose = [
    "creds",
    "validating",
    "validated",
    "starting",
    "awaiting_image_upload",
    "complete",
    "failed",
  ].includes(phase);

  return {
    allowBackdropClose,
    restartConnection,
    phase,
    setPhase,
    deploymentId,
    setDeploymentId,
    accountInfo,
    setAccountInfo,
    logs,
    setLogs,
    error,
    setError,
    containerId,
    outputs,
    accessKeyId,
    setAccessKeyId,
    secretAccessKey,
    setSecretAccessKey,
    sessionToken,
    setSessionToken,
    tenantId,
    setTenantId,
    subscriptionId,
    setSubscriptionId,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    projectId,
    setProjectId,
    clientEmail,
    setClientEmail,
    privateKey,
    setPrivateKey,
    gcpJsonPaste,
    setGcpJsonPaste,
    showAdvancedGcp,
    setShowAdvancedGcp,
    isResuming,
    formRegion,
    regionLocked,
    setRegionLocked,
    credentialSelection,
    setCredentialSelection,
    activeTab,
    setActiveTab,
    showCredsUpdate,
    setShowCredsUpdate,
    copiedUrls,
    hasPausedForUpload,
    setHasPausedForUpload,
    hasEcr,
    ecrOutputs,
    registryLabel,
    scriptFilePrefix,
    downloadBashScript,
    downloadPowerShellScript,
    stage1Status,
    stage2Status,
    stage3Status,
    canValidateCredentials,
    isGcpKeyConfigured,
    handleValidateCreds,
    handleDeploy,
    handleResume,
    handleDownloadPem,
    handleCopyLogs,
    handleCopyUrl,
    resolveSshKeyName,
    maskId: maskDeploymentId,
    providerLabel,
    handleGcpJsonPaste,
    activeStep,
    steps,
    phaseLabel,
    copied,
    runnerReportedSuccessRef,
  };
}
