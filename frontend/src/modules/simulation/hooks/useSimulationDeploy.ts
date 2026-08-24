"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch, buildApiUrl, getAuthToken } from "@/lib/auth-fetch";
import type { SimulationResponse } from "@/types/simulation";
import { logSimulationAction } from "@/lib/simulation-action-log";
import { useRegion } from "@/context/RegionContext";
import { serviceRegistry, type ServiceDefinition } from "../registry";

const LOADER_MAX_VISIBLE_MS = 5000;

function inferServiceId(node: any): string | undefined {
  if (typeof node?.data?.serviceId === "string") return node.data.serviceId;
  if (typeof node?.serviceId === "string") return node.serviceId;
  if (typeof node?.id === "string") {
    const service = serviceRegistry.find((item) => node.id.startsWith(`${item.id}_`));
    return service?.id;
  }
  return undefined;
}

function getServiceProvider(serviceId: string | undefined): ServiceDefinition["provider"] | undefined {
  if (serviceId === "github") return undefined;
  return serviceId ? serviceRegistry.find((item) => item.id === serviceId)?.provider : undefined;
}

function hydrateSavedNode(node: any, index: number) {
  const serviceId = inferServiceId(node);
  const def = serviceId ? serviceRegistry.find((item) => item.id === serviceId) : undefined;
  const existingData = node?.data || {};

  return {
    ...node,
    type: node.type || (def ? "service" : "annotation"),
    position: {
      x: typeof node.position?.x === "number" ? node.position.x : 100 + index * 100,
      y: typeof node.position?.y === "number" ? node.position.y : 100 + index * 100,
    },
    data: def
      ? {
          serviceId: def.id,
          label: existingData.label || def.label,
          description: existingData.description || def.description,
          icon: existingData.icon || def.icon,
          colorKey: existingData.colorKey || def.colorKey,
          ...existingData,
          config: {
            ...def.defaultConfig,
            ...(existingData.config || node.config || {}),
          },
        }
      : existingData,
  };
}

interface UseSimulationDeployProps {
  nodes: any[];
  edges: any[];
  setNodes: (n: any[]) => void;
  setEdges: (e: any[]) => void;
}

export function useSimulationDeploy({
  nodes,
  edges,
  setNodes,
  setEdges,
}: UseSimulationDeployProps) {
  const [session, setSession] = useState<SimulationResponse | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [simulation, setSimulation] = useState<any>(null);

  const [name, setName] = useState("Untitled Simulation");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  const [syncState, setSyncState] = useState<"saved" | "saving" | "unsaved">("saved");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  const [showTerraform, setShowTerraform] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const { selectedProvider, setSelectedProvider } = useRegion();
  const [pickerProvider, setPickerProvider] = useState<ServiceDefinition["provider"]>("azure");

  useEffect(() => {
    if (selectedProvider === "aws" || selectedProvider === "azure" || selectedProvider === "gcp") {
      setPickerProvider(selectedProvider);
    }
  }, [selectedProvider]);

  const loaderSteps = useMemo(() => {
    const steps = session?.steps || [];
    return steps.map((s) => ({ title: s.label }));
  }, [session?.steps]);

  const completedStepCount = useMemo(() => {
    return session?.steps?.filter((s) => s.status === "done").length || 0;
  }, [session?.steps]);

  const derivedRegion = useMemo(() => {
    const serviceNodes = nodes.filter(n => n.type === "service");
    let isAzure = false;
    let isGcp = false;
    for (const node of serviceNodes) {
      if (node.data?.serviceId?.startsWith("azure")) isAzure = true;
      if (node.data?.serviceId?.startsWith("gcp_")) isGcp = true;
      if (node.data?.config?.region) return node.data.config.region as string;
    }
    return isAzure ? "eastus" : isGcp ? "us-central1" : "us-east-1";
  }, [nodes]);

  const derivedProvider = useMemo<"aws" | "azure" | "gcp">(() => {
    const serviceNodes = nodes.filter(n => n.type === "service");
    for (const node of serviceNodes) {
      if (node.data?.serviceId?.startsWith("gcp_")) return "gcp";
      if (node.data?.serviceId?.startsWith("azure")) return "azure";
    }
    return "aws";
  }, [nodes]);

  const activeServiceProvider = useMemo<ServiceDefinition["provider"]>(() => {
    const serviceNode = nodes.find((node) => node.type === "service" && node.data?.serviceId !== "github");
    return getServiceProvider(serviceNode?.data?.serviceId) || pickerProvider;
  }, [nodes, pickerProvider]);

  const logCanvasAction = useCallback(
    (input: Parameters<typeof logSimulationAction>[0]) => {
      void logSimulationAction({
        region: derivedRegion,
        simulationId: draftId,
        simulationName: name,
        ...input,
        metadata: {
          ...input.metadata,
          provider: pickerProvider,
        },
      });
    },
    [derivedRegion, draftId, name, pickerProvider],
  );

  const startSimulationSession = useCallback(async () => {
    setPhase("loading");
    setSession(null);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const simId = urlParams.get("id");
      const shouldOpenDeploy = urlParams.get("openDeploy") === "1" || urlParams.get("deploy") === "1";

      if (simId) {
        const draftRes = await authFetch(`/api/simulations/${simId}`);
        if (draftRes.ok) {
          const draftData = await draftRes.json();
          if (draftData.success && draftData.simulation) {
            setDraftId(draftData.simulation._id);
            setName(draftData.simulation.name || "Untitled Simulation");
            setSimulation(draftData.simulation);
            if (draftData.simulation.provider) {
              setSelectedProvider(draftData.simulation.provider);
              setPickerProvider(draftData.simulation.provider);
            }
            if (draftData.simulation.graph) {
              const dbNodes = draftData.simulation.graph.nodes || [];
              const safeNodes = dbNodes.map(hydrateSavedNode);
              setNodes(safeNodes);
              setEdges(draftData.simulation.graph.edges || []);
              if (shouldOpenDeploy && safeNodes.length > 0) {
                setShowTerraform(false);
                setShowDeploy(true);
              }
            }
          }
        }
      }

      const res = await authFetch("/api/simulation/session", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      
      if (data) {
        setSession(data);
        void logSimulationAction({
          actionId: "simulation-session-started",
          displayName: "Opened simulation canvas",
          status: "created",
          region: "us-east-1",
          target: { resourceId: data.id, resourceName: name },
          metadata: { orchestrator: data.orchestrator },
        });
        if (data.status === "ready" || data.status === "timed_out") {
          setPhase("ready");
        } else if (["error", "terminated"].includes(data.status)) {
          setPhase("error");
        }
      }
    } catch (err) {
      console.error("Failed to initialize simulation:", err);
      setSession(prev => prev ?? { id: "local", status: "ready" } as SimulationResponse);
      setPhase("ready");
    }
  }, [name, setNodes, setEdges, setSelectedProvider]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void startSimulationSession();
    return () => {
      initializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE & Fallback polling for status
  useEffect(() => {
    if (!session?.id || phase !== "loading") return;

    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isReconnecting = false;
    let retryCount = 0;

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        try {
          const res = await authFetch(`/api/simulation/session/${session.id}`);
          if (!res.ok) {
            if (res.status === 404) {
              setPhase("error");
              stopPolling();
            }
            return;
          }
          const data = await res.json();
          if (data) {
            setSession(data);
            if (["ready", "timed_out"].includes(data.status)) {
              setPhase("ready");
              stopPolling();
            } else if (["error", "terminated"].includes(data.status)) {
              setPhase("error");
              stopPolling();
            }
          }
        } catch (err) {
          console.error(err);
        }
      }, 3000);
    };

    const connectSSE = () => {
      if (eventSource) eventSource.close();
      const token = getAuthToken();
      if (!token) {
        setPhase("error");
        return;
      }

      const isDev = process.env.NODE_ENV === "development";
      if (!isDev) {
        // SSE/EventSource is not supported on AWS Amplify/API Gateway, fall back directly to polling.
        startPolling();
        return;
      }

      const url = buildApiUrl(`/api/simulation/session/${session.id}/stream?token=${encodeURIComponent(token)}`);
      eventSource = new EventSource(url);

      eventSource.addEventListener("update", (event) => {
        try {
          const data = JSON.parse(event.data);
          setSession(prev => prev ? { ...prev, ...data } : data);
          if (["ready", "timed_out"].includes(data.status)) {
            setPhase("ready");
            eventSource?.close();
            stopPolling();
          } else if (["error", "terminated"].includes(data.status)) {
            setPhase("error");
            eventSource?.close();
            stopPolling();
          }
          retryCount = 0;
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener("complete", () => {
        eventSource?.close();
        stopPolling();
      });

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (!isReconnecting && phase === "loading") {
          isReconnecting = true;
          startPolling();
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryCount++;
          reconnectTimeout = setTimeout(() => {
            isReconnecting = false;
            if (phase === "loading") connectSSE();
          }, delay);
        }
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      stopPolling();
    };
  }, [session?.id, phase]);

  // Debounced auto-save
  useEffect(() => {
    if (phase !== "ready" || nodes.length === 0) return;
    setSyncState("unsaved");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSyncState("saving");
      try {
        const payload = { name, region: derivedRegion, provider: activeServiceProvider, nodes, edges };
        let res;
        if (draftId) {
          res = await authFetch(`/api/simulations/${draftId}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          res = await authFetch("/api/simulations", { method: "POST", body: JSON.stringify(payload) });
        }
        const data = await res.json();
        if (data.success && data.simulation) {
          setSimulation(data.simulation);
          if (!draftId) {
            setDraftId(data.simulation._id);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("id", data.simulation._id);
            window.history.replaceState({}, "", newUrl);
          }
          setSyncState("saved");
        } else {
          setSyncState("unsaved");
        }
      } catch (err) {
        setSyncState("unsaved");
      }
    }, 1500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [nodes, edges, name, draftId, phase, derivedRegion, activeServiceProvider]);

  const handleManualSave = useCallback(async () => {
    if (syncState === "saved" || nodes.length === 0) return;
    setSyncState("saving");
    try {
      const payload = { name, region: derivedRegion, provider: activeServiceProvider, nodes, edges };
      let res;
      if (draftId) {
        res = await authFetch(`/api/simulations/${draftId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        res = await authFetch("/api/simulations", { method: "POST", body: JSON.stringify(payload) });
      }
      const data = await res.json();
      if (data.success && data.simulation) {
        setSimulation(data.simulation);
        if (!draftId) {
          setDraftId(data.simulation._id);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("id", data.simulation._id);
          window.history.replaceState({}, "", newUrl);
        }
        setSyncState("saved");
        logCanvasAction({
          actionId: "simulation-manual-save",
          displayName: "Saved simulation draft",
          target: { resourceId: data.simulation._id, resourceName: name },
          metadata: { nodeCount: nodes.length, edgeCount: edges.length },
        });
      }
    } catch (err) {
      console.error(err);
      setSyncState("unsaved");
    }
  }, [name, draftId, nodes, edges, syncState, derivedRegion, activeServiceProvider, logCanvasAction]);

  const handleOpenTerraform = useCallback(() => {
    setShowTerraform(true);
    logCanvasAction({
      actionId: "simulation-hcl-preview-opened",
      displayName: "Opened Terraform preview",
      metadata: { nodeCount: nodes.length, edgeCount: edges.length },
    });
  }, [nodes.length, edges.length, logCanvasAction]);

  const handleOpenDeploy = useCallback(() => {
    setShowDeploy(true);
    setShowTerraform(false);
    logCanvasAction({
      actionId: "simulation-deploy-panel-opened",
      displayName: "Opened simulation deployment panel",
      status: "created",
      metadata: { nodeCount: nodes.length, edgeCount: edges.length },
    });
  }, [nodes.length, edges.length, logCanvasAction]);

  const handleCancelSimulation = useCallback(async () => {
    if (!session?.id) return;
    try {
      await authFetch(`/api/simulation/session/${session.id}/terminate`, { method: "POST" });
      setPhase("error");
      setSession(prev => prev ? { ...prev, status: "terminated", errorMessage: "Simulation cancelled by user" } : null);
      logCanvasAction({
        actionId: "simulation-session-cancelled",
        displayName: "Cancelled simulation session",
        status: "failed",
        target: { resourceId: session.id, resourceName: name },
      });
    } catch (err) {
      console.error("Failed to cancel simulation:", err);
    }
  }, [session?.id, name, logCanvasAction]);

  useEffect(() => {
    if (phase !== "loading") return;
    const timeout = setTimeout(() => {
      setPhase((current) => current === "loading" ? "ready" : current);
      setSession(prev => prev ?? { id: "local", status: "ready" } as SimulationResponse);
    }, LOADER_MAX_VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, [phase, session]);

  return {
    session,
    phase,
    setPhase,
    simulation,
    setSimulation,
    name,
    setName,
    draftId,
    setDraftId,
    deploymentId,
    setDeploymentId,
    syncState,
    setSyncState,
    startSimulationSession,
    handleCancelSimulation,
    loaderSteps,
    completedStepCount,
    derivedRegion,
    derivedProvider,
    activeServiceProvider,
    logCanvasAction,
    showTerraform,
    setShowTerraform,
    showDeploy,
    setShowDeploy,
    pickerProvider,
    setPickerProvider,
    handleOpenTerraform,
    handleOpenDeploy,
    handleManualSave,
  };
}
