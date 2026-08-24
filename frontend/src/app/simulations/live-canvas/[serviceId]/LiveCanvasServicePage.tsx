"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import {
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
} from "reactflow";
import "reactflow/dist/style.css";
import { authFetch } from "@/lib/auth-fetch";
import { serviceRegistry } from "@/modules/simulation";
import { RefreshCw } from "@/icons";
import { useRouter } from "next/navigation";
import { useRegion } from "@/context/RegionContext";
import { logSimulationAction } from "@/lib/simulation-action-log";

import { LiveCanvasDetailsPanel } from "./live-canvas/LiveCanvasDetailsPanel";
import { LiveCanvasDialogs } from "./live-canvas/LiveCanvasDialogs";
import { LiveCanvasFlow } from "./live-canvas/LiveCanvasFlow";
import { LiveCanvasRegionPanel } from "./live-canvas/LiveCanvasRegionPanel";
import { LiveCanvasTopbar } from "./live-canvas/LiveCanvasTopbar";
import { useLiveCanvasActions } from "./live-canvas/useLiveCanvasActions";
import { useLiveCanvasEcrExpansion } from "./live-canvas/useLiveCanvasEcrExpansion";
import { useLiveCanvasSelectedNodeEffects } from "./live-canvas/useLiveCanvasSelectedNodeEffects";
import {
  MAPPERS,
  inventoryKeyForService,
  metricServiceForProvider,
} from "./live-canvas/liveCanvasHelpers";
export default function LiveCanvasServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const router = useRouter();
  useEffect(() => {
    if (serviceId === "github") {
      router.replace("/simulations/live-canvas");
    }
  }, [serviceId, router]);

  const { selectedProvider, selectedRegion: region } = useRegion();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [sshCopied, setSshCopied] = useState(false);
  const [httpCopied, setHttpCopied] = useState(false);
  const handleCopySsh = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setSshCopied(true);
    setTimeout(() => setSshCopied(false), 2000);
  };
  const handleCopyHttp = (url: string) => {
    navigator.clipboard.writeText(url);
    setHttpCopied(true);
    setTimeout(() => setHttpCopied(false), 2000);
  };
  const handleCopyCmd = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmdIndex(idx);
    setTimeout(() => setCopiedCmdIndex(null), 2000);
  };
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [safetyCheck, setSafetyCheck] = useState<{
    loading: boolean;
    isDeletable: boolean;
    reason: string | null;
    helperAction: string | null;
    helperLabel: string | null;
    warning: string | null;
  } | null>(null);
  const [lambdaCode, setLambdaCode] = useState<string | null>(null);
  const [isLambdaCodeLoading, setIsLambdaCodeLoading] = useState(false);
  const [lambdaFilename, setLambdaFilename] = useState("index.js");
  const [isCodeDirty, setIsCodeDirty] = useState(false);
  const [sshUsername, setSshUsername] = useState("ec2-user");
  const [sshKeyName, setSshKeyName] = useState("sim-key");
  const [rawInventory, setRawInventory] = useState<any>(null);
  const [copiedCmdIndex, setCopiedCmdIndex] = useState<number | null>(null);
  const [isNodeDragging, setIsNodeDragging] = useState(false);

  useLiveCanvasSelectedNodeEffects({
    selectedNode,
    selectedProvider,
    region,
    setSshUsername,
    setSshKeyName,
    setLambdaCode,
    setLambdaFilename,
    setIsLambdaCodeLoading,
    setIsCodeDirty,
    setSafetyCheck,
  });

  // Region Selection State
  const [isRegionPanelOpen, setIsRegionPanelOpen] = useState(false);
  const [viewRegion, setViewRegion] = useState<string>("all");
  const [allInventory, setAllInventory] = useState<any[]>([]);
  const [regionCounts, setRegionCounts] = useState<Record<string, number>>({});
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  // Ref to hold the latest metrics data for synchronous access in fetchInventory
  const metricsDataRef = useRef<any>(null);

  const serviceConfig = serviceRegistry.find(s => s.id === serviceId);

  const {
    expandedRepoId,
    isLayoutAnimating,
    collapseRepoImages,
    resetExpandedRepo,
    toggleRepoImages,
  } = useLiveCanvasEcrExpansion({ nodes, region, setNodes, setEdges });

  const {
    isActionLoading,
    actionModalOpen,
    setActionModalOpen,
    actionPayload,
    setActionPayload,
    activeDeploymentId,
    setActiveDeploymentId,
    selectedInstanceId,
    setSelectedInstanceId,
    deployCodeModalOpen,
    setDeployCodeModalOpen,
    confirmCodeDeployment,
    openActionModal,
    confirmNodeAction,
  } = useLiveCanvasActions({
    selectedNode,
    setSelectedNode,
    selectedProvider,
    region,
    serviceId,
    nodes,
    setNodes,
    lambdaCode,
    setIsCodeDirty,
  });

  const onNodeClick = useCallback((_: React.MouseEvent, node: FlowNode) => {
    if (node.id === "region-hub") {
      setIsRegionPanelOpen(true);
      setSelectedNode(null);
      void logSimulationAction({
        actionId: "live-region-selector-opened",
        displayName: "Opened live canvas region selector",
        status: "simulated",
        region,
        target: { resourceId: serviceId, resourceName: serviceConfig?.label || serviceId },
        metadata: { viewRegion, provider: selectedProvider },
      });
      return;
    }

    // Toggle ECR Repository Images Child Nodes
    if (node.data?.serviceId === "ecr") {
      // Clicked the ECR repository node body. Clicking should select the node and open details sidebar,
      // but should NOT toggle/expand the images on canvas.
    } else if (node.id.startsWith("ecr_image_")) {
      // Clicked a dynamic child image node
    } else {
      // Clicked any other service node: collapse repository images
      collapseRepoImages();
    }

    setSelectedNode(node);
    setIsRegionPanelOpen(false);
    void logSimulationAction({
      actionId: "live-resource-selected",
      displayName: `Selected live resource: ${node.data?.label || node.id}`,
      status: "simulated",
      region: node.data?.item?.region || region,
      target: { resourceId: node.data?.item?.id || node.data?.item?.name || node.id, resourceName: node.data?.label || node.id },
      metadata: { serviceId, viewRegion, provider: selectedProvider },
    });
  }, [region, serviceId, serviceConfig?.label, viewRegion, setNodes, setEdges, collapseRepoImages]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsRegionPanelOpen(false);
    collapseRepoImages();
  }, [collapseRepoImages]);

  // Fetch metrics data asynchronously
  useEffect(() => {
    if (serviceId === "github") return;
    let active = true;
    authFetch(`/api/${selectedProvider}/metrics?service=${metricServiceForProvider(serviceId)}&region=${region}&range=24h`)
      .then(res => res.json())
      .then(data => {
        if (active && data.success) {
          setMetricsData(data);
          metricsDataRef.current = data;
        }
      })
      .catch(err => console.error("Failed to fetch metrics:", err));
    return () => { active = false; };
  }, [serviceId, region, selectedProvider]);

  // Apply metrics data to nodes when available
  useEffect(() => {
    if (!metricsData) return;
    setNodes(nds => {
       let changed = false;
       const newNodes = nds.map(n => {
          let newMetrics = n.data?.metrics;
          if (n.data?.serviceId === 's3' && metricsData.buckets) {
             const bucket = metricsData.buckets.find((b: any) => b.name === n.data.label);
             if (bucket) {
                newMetrics = { sizeBytes: bucket.sizeBytes, objectCount: bucket.objectCount };
             }
          }
          if (n.data?.serviceId === 'ecs' && metricsData.services) {
             const svc = metricsData.services.find((s: any) => s.name === n.data.label || s.cluster === n.data.label || `${s.cluster}:${s.name}` === n.data.label || s.cluster === n.data.config?.clusterName);
             if (svc) {
                newMetrics = { cpu: svc.cpu, memory: svc.memory, tasks: svc.runningTasks };
             }
          }
          
          if (JSON.stringify(newMetrics) !== JSON.stringify(n.data?.metrics)) {
             changed = true;
             return { ...n, data: { ...n.data, metrics: newMetrics } };
          }
          return n;
       });
       return changed ? newNodes : nds;
    });
  }, [metricsData, setNodes]); // run when metricsData changes

  const fetchInventory = useCallback(async (forceRefresh = false) => {
    if (serviceId === "github") return;
    setLoading(true);
    try {
      // Fetch for all regions to allow global filtering
      const res = await authFetch(`/api/${selectedProvider}/resources?region=all${forceRefresh === true ? '&forceRefresh=true' : ''}`, {
        cache: "no-store",
        headers: forceRefresh ? { "x-rabbittwatch-cache-bypass": "true" } : undefined,
      });
      const data = await res.json();

      if (data.success && data.inventory) {
        const inv = data.inventory;
        setRawInventory(inv);
        const inventoryKey = inventoryKeyForService(serviceId);
        const items = Array.isArray(inv[inventoryKey]) ? inv[inventoryKey] : [];
        setAllInventory(items);
        
        // Count per region
        const counts: Record<string, number> = {};
        items.forEach((item: any) => {
          const r = item.region || "unknown";
          counts[r] = (counts[r] || 0) + 1;
        });
        setRegionCounts(counts);

        if (data.timestamp) {
           setLastUpdated(new Date(data.timestamp).toLocaleTimeString());
        }
      }
    } catch (err) {
      console.error("Failed to fetch live inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [serviceId, selectedProvider]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Build nodes and edges based on viewRegion
  useEffect(() => {
    if (loading) return;
    resetExpandedRepo();

    const centerX = 500;
    const centerY = 400;
    const newNodes: FlowNode[] = [];
    const newEdges: any[] = [];

    // Add a central Region Hub node
    newNodes.push({
      id: "region-hub",
      type: "default",
      position: { x: centerX - 50, y: centerY - 50 },
      data: { label: viewRegion === "all" ? "ALL" : viewRegion.toUpperCase() },
      style: {
          background: 'rgba(59, 130, 246, 0.05)',
          border: '2px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '100%',
          width: 100,
          height: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3b82f6',
          fontSize: '12px',
          fontWeight: '900',
          boxShadow: '0 0 40px rgba(59, 130, 246, 0.15)',
          cursor: 'pointer'
      },
      draggable: false
    });

    const getCreationDate = (item: any) => {
        const dateStr = item.launchTime || item.creationDate || item.lastModified || item.createdAt || item.InstanceCreateTime || item.createdDate;
        return dateStr ? new Date(dateStr).getTime() : 0;
    };

    const filteredItems = viewRegion === "all" 
      ? allInventory 
      : allInventory.filter(item => item.region === viewRegion);

    const sortedItems = [...filteredItems].sort((a, b) => {
        const regionA = a.region || "";
        const regionB = b.region || "";
        if (regionA !== regionB) {
          return regionA.localeCompare(regionB);
        }
        return getCreationDate(b) - getCreationDate(a);
    });

    sortedItems.forEach((item: any, i: number) => {
        if (MAPPERS[serviceId]) {
          // Golden angle (Fibonacci) spiral layout
          const angle = i * 2.39996; // 137.5 degrees in radians
          const radius = 250 + (Math.sqrt(i) * 120); // start at 250px, expand organically
          
          const nodeX = centerX + radius * Math.cos(angle) - 125;
          const nodeY = centerY + radius * Math.sin(angle) - 45;

          const node = MAPPERS[serviceId](item, nodeX, nodeY);
          if (serviceId === "ecr") {
            node.data = {
              ...node.data,
              isExpanded: false,
              onToggleExpand: (e: any) => {
                e.stopPropagation();
                toggleRepoImages(node.id, item.images || [], node.position.x, node.position.y);
              }
            };
          }
          if (serviceConfig) {
            const ts = getCreationDate(item);
            let desc = serviceConfig.description;
            if (item.type === "snapshot") {
              desc = "Database Snapshot";
            }
            if (ts > 0) {
                const dateStr = new Date(ts).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                });
                desc = item.type === "snapshot" ? `Snapshot • ${dateStr}` : dateStr;
            }
            if (item.region && (viewRegion === "all" || item.region !== viewRegion)) {
              desc = `${item.region} • ${desc}`;
            }

            node.data.description = desc;
            node.data.icon = serviceConfig.icon;
            node.data.colorKey = serviceConfig.colorKey;
            node.data.item = item;

            if (metricsDataRef.current) {
                const mData = metricsDataRef.current;
                if (serviceId === 's3' && mData.buckets) {
                  const bucket = mData.buckets.find((b: any) => b.name === node.data.label);
                  if (bucket) {
                      node.data.metrics = { sizeBytes: bucket.sizeBytes, objectCount: bucket.objectCount };
                  }
                }
                if (serviceId === 'ecs' && mData.services) {
                  const svc = mData.services.find((s: any) => s.name === node.data.label || s.cluster === node.data.label || `${s.cluster}:${s.name}` === node.data.label || s.cluster === node.data.config?.clusterName);
                  if (svc) {
                      node.data.metrics = { cpu: svc.cpu, memory: svc.memory, tasks: svc.runningTasks };
                  }
                }
            }
          }
          newNodes.push(node);

          // Connect node to the hub
          newEdges.push({
            id: `edge-hub-${node.id}`,
            source: "region-hub",
            target: node.id,
            type: "smoothstep",
            animated: true,
            style: { stroke: 'rgba(59, 130, 246, 0.3)', strokeWidth: 2 },
          });
        }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [viewRegion, allInventory, loading, serviceId, serviceConfig, setNodes, setEdges, toggleRepoImages, resetExpandedRepo]);

  if (serviceId === "github") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="simulation-surface relative flex h-screen w-full flex-col">
      <LiveCanvasTopbar
        serviceConfig={serviceConfig}
        serviceId={serviceId}
        lastUpdated={lastUpdated}
        selectedProvider={selectedProvider}
        viewRegion={viewRegion}
        allInventory={allInventory}
        fetchInventory={fetchInventory}
        loading={loading}
      />
      <main className="relative flex-1">
        <LiveCanvasFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={() => setIsNodeDragging(true)}
          onNodeDragStop={() => setIsNodeDragging(false)}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          isLayoutAnimating={isLayoutAnimating}
          isNodeDragging={isNodeDragging}
        />

        <LiveCanvasRegionPanel
          isRegionPanelOpen={isRegionPanelOpen}
          setIsRegionPanelOpen={setIsRegionPanelOpen}
          serviceConfig={serviceConfig}
          serviceId={serviceId}
          allInventory={allInventory}
          regionCounts={regionCounts}
          viewRegion={viewRegion}
          setViewRegion={setViewRegion}
          selectedProvider={selectedProvider}
        />
        <LiveCanvasDetailsPanel
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          region={region}
          copiedCmdIndex={copiedCmdIndex}
          handleCopyCmd={handleCopyCmd}
          sshKeyName={sshKeyName}
          setSshKeyName={setSshKeyName}
          sshUsername={sshUsername}
          setSshUsername={setSshUsername}
          httpCopied={httpCopied}
          handleCopyHttp={handleCopyHttp}
          sshCopied={sshCopied}
          handleCopySsh={handleCopySsh}
          selectedProvider={selectedProvider}
          lambdaFilename={lambdaFilename}
          isLambdaCodeLoading={isLambdaCodeLoading}
          lambdaCode={lambdaCode}
          setLambdaCode={setLambdaCode}
          setIsCodeDirty={setIsCodeDirty}
          isCodeDirty={isCodeDirty}
          setDeployCodeModalOpen={setDeployCodeModalOpen}
          isActionLoading={isActionLoading}
          safetyCheck={safetyCheck}
          openActionModal={openActionModal}
          nodes={nodes}
          toggleRepoImages={toggleRepoImages}
          expandedRepoId={expandedRepoId}
        />
        <LiveCanvasDialogs
          deployCodeModalOpen={deployCodeModalOpen}
          setDeployCodeModalOpen={setDeployCodeModalOpen}
          selectedNode={selectedNode}
          confirmCodeDeployment={confirmCodeDeployment}
          isActionLoading={isActionLoading}
          actionModalOpen={actionModalOpen}
          setActionModalOpen={setActionModalOpen}
          actionPayload={actionPayload}
          viewRegion={viewRegion}
          rawInventory={rawInventory}
          selectedInstanceId={selectedInstanceId}
          setSelectedInstanceId={setSelectedInstanceId}
          confirmNodeAction={confirmNodeAction}
          activeDeploymentId={activeDeploymentId}
          serviceId={serviceId}
          selectedProvider={selectedProvider}
          setActiveDeploymentId={setActiveDeploymentId}
          setActionPayload={setActionPayload}
          fetchInventory={fetchInventory}
        />
      </main>
    </div>
  );
}
