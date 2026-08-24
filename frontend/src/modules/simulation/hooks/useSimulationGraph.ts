"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  type OnConnect,
  type ReactFlowInstance,
  type Node as FlowNode,
  type Edge,
} from "reactflow";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import type { ServiceNodeData } from "../components/Canvas/nodes";
import { findService, serviceRegistry, type ServiceDefinition } from "../registry";

function generateId(prefix = "node") {
  return `${prefix}_${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getServiceProvider(serviceId: string | undefined): ServiceDefinition["provider"] | undefined {
  if (serviceId === "github") return undefined;
  return serviceId ? serviceRegistry.find((item) => item.id === serviceId)?.provider : undefined;
}

function findServiceForProvider(
  serviceId: string,
  provider: ServiceDefinition["provider"],
): ServiceDefinition | undefined {
  return serviceRegistry.find((item) => item.id === serviceId && item.provider === provider)
    || serviceRegistry.find((item) => item.id === serviceId);
}

interface UseSimulationGraphProps {
  activeServiceProvider: ServiceDefinition["provider"];
  pickerProvider: ServiceDefinition["provider"];
  deploymentId: string | null;
  logCanvasAction: (input: any) => void;
  takeSnapshotExternal?: () => void;
  name: string;
}

export function useSimulationGraph({
  activeServiceProvider,
  pickerProvider,
  deploymentId,
  logCanvasAction,
  name,
}: UseSimulationGraphProps) {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<ServiceNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo(nodes, edges, setNodes, setEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId && n.type === "service") as FlowNode<ServiceNodeData> | undefined,
    [nodes, selectedNodeId],
  );

  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const baseNode = node.type === "annotation"
          ? {
              ...node,
              data: {
                ...node.data,
                onTextChange: (text: string) => {
                  setNodes((items) =>
                    items.map((item) =>
                      item.id === node.id ? { ...item, data: { ...item.data, text } } : item,
                    ),
                  );
                },
              },
            }
          : node;

        if (baseNode.type === "service") {
          return {
            ...baseNode,
            data: {
              ...baseNode.data,
              deploymentId: deploymentId,
            },
          };
        }
        return baseNode;
      }),
    [nodes, setNodes, deploymentId],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target) return;
      const edge: Edge = {
        id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source,
        target,
        animated: true,
        style: { stroke: "var(--primary)", strokeWidth: 2 },
        ...(sourceHandle != null && { sourceHandle }),
        ...(targetHandle != null && { targetHandle }),
      };
      setEdges((eds) => [...eds, edge]);
      logCanvasAction({
        actionId: "simulation-edge-connected",
        displayName: "Connected simulation resources",
        target: { resourceId: edge.id, resourceName: `${source} to ${target}` },
        metadata: { source, target, sourceHandle, targetHandle },
      });
    },
    [setEdges, logCanvasAction],
  );

  const addNode = useCallback(
    (serviceId: string) => {
      const def = findServiceForProvider(serviceId, activeServiceProvider);
      if (!def) return;
      const existingProvider = nodes
        .filter((node) => node.type === "service" && node.data?.serviceId !== "github")
        .map((node) => getServiceProvider(node.data?.serviceId))
        .find(Boolean);

      if (existingProvider && existingProvider !== def.provider) {
        logCanvasAction({
          actionId: "simulation-provider-mix-blocked",
          displayName: `Blocked ${def.provider.toUpperCase()} node in ${existingProvider.toUpperCase()} simulation`,
          status: "failed",
          target: { resourceId: serviceId, resourceName: def.label },
          metadata: { existingProvider, requestedProvider: def.provider },
        });
        return;
      }

      const center = reactFlowInstance
        ? reactFlowInstance.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          })
        : { x: 0, y: 0 };

      const node: FlowNode<ServiceNodeData> = {
        id: generateId(def.id),
        type: "service",
        position: { x: center.x - 124, y: center.y - 64 },
        data: {
          serviceId: def.id,
          label: def.label,
          description: def.description,
          icon: def.icon,
          colorKey: def.colorKey,
          config: def.defaultConfig,
        },
      };

      setNodes((nds) => [...nds, node]);
      logCanvasAction({
        actionId: "simulation-node-added",
        displayName: `Added ${def.label} to simulation`,
        target: { resourceId: node.id, resourceName: def.label },
        metadata: { serviceId: def.id, config: def.defaultConfig },
      });
    },
    [activeServiceProvider, nodes, reactFlowInstance, setNodes, logCanvasAction],
  );

  const removeNode = useCallback(
    (id: string) => {
      const node = nodes.find((item) => item.id === id);
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      logCanvasAction({
        actionId: "simulation-node-removed",
        displayName: `Removed ${node?.data?.label || "resource"} from simulation`,
        target: { resourceId: id, resourceName: node?.data?.label || id },
        metadata: { serviceId: node?.data?.serviceId },
      });
    },
    [nodes, setNodes, setEdges, logCanvasAction],
  );

  const clearCanvas = useCallback(() => {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    setNodes([]);
    setEdges([]);
    logCanvasAction({
      actionId: "simulation-canvas-cleared",
      displayName: "Cleared simulation canvas",
      metadata: { nodeCount, edgeCount },
    });
  }, [nodes.length, edges.length, setNodes, setEdges, logCanvasAction]);

  const addAnnotation = useCallback(() => {
    takeSnapshot();
    const center = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
      : { x: 0, y: 0 };

    setNodes((nds) => [
      ...nds,
      {
        id: generateId("note"),
        type: "annotation",
        position: { x: center.x - 120, y: center.y - 56 },
        width: 240,
        height: 144,
        data: { text: "Add architecture notes here" },
      } as FlowNode,
    ]);
  }, [reactFlowInstance, setNodes, takeSnapshot]);

  const autoLayoutNodes = useCallback(() => {
    const serviceNodes: FlowNode[] = [];
    const otherNodes: FlowNode[] = [];

    nodes.forEach((node) => {
      if (node.type === "annotation") {
        otherNodes.push(node);
      } else {
        serviceNodes.push(node);
      }
    });

    if (serviceNodes.length === 0) {
      const newNodes = nodes.map((node, idx) => ({
        ...node,
        position: { x: 50, y: 100 + idx * 160 }
      }));
      setNodes(newNodes);
      takeSnapshot();
      return;
    }

    const adj = new Map<string, string[]>();
    const inEdges = new Map<string, string[]>();
    const undirectedAdj = new Map<string, string[]>();

    serviceNodes.forEach((n) => {
      adj.set(n.id, []);
      inEdges.set(n.id, []);
      undirectedAdj.set(n.id, []);
    });

    edges.forEach((edge) => {
      if (edge.source === edge.target) return;
      if (adj.has(edge.source) && adj.has(edge.target)) {
        adj.get(edge.source)!.push(edge.target);
        inEdges.get(edge.target)!.push(edge.source);
        undirectedAdj.get(edge.source)!.push(edge.target);
        undirectedAdj.get(edge.target)!.push(edge.source);
      }
    });

    const visitedComponents = new Set<string>();
    const components: string[][] = [];

    serviceNodes.forEach((node) => {
      if (!visitedComponents.has(node.id)) {
        const comp: string[] = [];
        const queue = [node.id];
        visitedComponents.add(node.id);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          comp.push(curr);
          const neighbors = undirectedAdj.get(curr) || [];
          neighbors.forEach((nbr) => {
            if (!visitedComponents.has(nbr)) {
              visitedComponents.add(nbr);
              queue.push(nbr);
            }
          });
        }
        components.push(comp);
      }
    });

    const nodeCoords = new Map<string, { x: number; y: number }>();
    const HORIZONTAL_SPACING = 360;
    const VERTICAL_SPACING = 240;

    const layoutComponent = (compNodes: string[], startX: number) => {
      const compSet = new Set(compNodes);
      const tempVisited = new Set<string>();
      const permVisited = new Set<string>();
      const backEdges = new Set<string>();

      const detectCycles = (u: string) => {
        tempVisited.add(u);
        const children = adj.get(u) || [];
        children.forEach((v) => {
          if (!compSet.has(v)) return;
          if (tempVisited.has(v)) {
            backEdges.add(`${u}->${v}`);
          } else if (!permVisited.has(v)) {
            detectCycles(v);
          }
        });
        tempVisited.delete(u);
        permVisited.add(u);
      };

      compNodes.forEach((nodeId) => {
        if (!permVisited.has(nodeId)) {
          detectCycles(nodeId);
        }
      });

      const memo = new Map<string, number>();
      const computeLayer = (u: string, pathStack = new Set<string>()): number => {
        if (memo.has(u)) return memo.get(u)!;
        if (pathStack.has(u)) return 0;
        pathStack.add(u);

        const parents = (inEdges.get(u) || []).filter(
          (p) => compSet.has(p) && !backEdges.has(`${p}->${u}`)
        );

        let layer = 0;
        if (parents.length > 0) {
          layer = Math.max(...parents.map((p) => computeLayer(p, pathStack))) + 1;
        }

        pathStack.delete(u);
        memo.set(u, layer);
        return layer;
      };

      compNodes.forEach((nodeId) => {
        computeLayer(nodeId);
      });

      const layerGroups = new Map<number, string[]>();
      let maxLayer = 0;
      compNodes.forEach((nodeId) => {
        const layer = memo.get(nodeId) || 0;
        if (!layerGroups.has(layer)) {
          layerGroups.set(layer, []);
        }
        layerGroups.get(layer)!.push(nodeId);
        if (layer > maxLayer) maxLayer = layer;
      });

      const compCoords = new Map<string, { x: number; y: number }>();
      let minX = Infinity;
      let maxX = -Infinity;

      for (let l = 0; l <= maxLayer; l++) {
        const layerNodes = layerGroups.get(l) || [];
        if (layerNodes.length === 0) continue;

        const getBarycenterWeight = (u: string): number => {
          const parents = (inEdges.get(u) || []).filter(
            (p) => compSet.has(p) && compCoords.has(p)
          );
          if (parents.length === 0) {
            const orig = nodes.find((n) => n.id === u);
            return orig?.position?.x ?? 0;
          }
          const sum = parents.reduce((acc, p) => acc + compCoords.get(p)!.x, 0);
          return sum / parents.length;
        };

        const sorted = [...layerNodes].sort((a, b) => {
          const wA = getBarycenterWeight(a);
          const wB = getBarycenterWeight(b);
          if (wA !== wB) return wA - wB;
          return a.localeCompare(b);
        });

        const count = sorted.length;
        sorted.forEach((nodeId, idx) => {
          const offset = (idx - (count - 1) / 2) * HORIZONTAL_SPACING;
          const x = startX + offset;
          const y = 100 + l * VERTICAL_SPACING;
          compCoords.set(nodeId, { x, y });

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        });
      }

      const width = maxX >= minX ? (maxX - minX + HORIZONTAL_SPACING) : HORIZONTAL_SPACING;
      const centerOffset = minX !== Infinity ? (minX - startX) : 0;

      compCoords.forEach((coord, id) => {
        nodeCoords.set(id, { x: coord.x - centerOffset, y: coord.y });
      });

      return width;
    };

    let currentX = 100;
    const COMPONENT_GAP = 240;

    components.forEach((comp) => {
      const width = layoutComponent(comp, currentX);
      currentX += width + COMPONENT_GAP;
    });

    otherNodes.forEach((node, idx) => {
      nodeCoords.set(node.id, { x: -300, y: 100 + idx * 160 });
    });

    const formattedNodes = nodes.map((node) => {
      const coord = nodeCoords.get(node.id);
      if (coord) {
        return {
          ...node,
          position: { x: Math.round(coord.x), y: Math.round(coord.y) }
        };
      }
      return node;
    });

    setNodes(formattedNodes);
    takeSnapshot();
    logCanvasAction({
      actionId: "simulation-auto-layout",
      displayName: "Automatically formatted canvas layout",
      metadata: { nodeCount: nodes.length },
    });
  }, [nodes, edges, setNodes, takeSnapshot, logCanvasAction]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: FlowNode) => {
      setSelectedNodeId(node.id);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Keyboard listener for delete key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        const currentNodes = nodesRef.current;
        const currentEdges = edgesRef.current;

        const selectedNodeIds = currentNodes.filter((n) => n.selected).map((n) => n.id);
        const selectedEdgeIds = currentEdges.filter((e) => e.selected).map((e) => e.id);

        if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) {
          e.preventDefault();
          takeSnapshot();

          if (selectedNodeIds.length > 0) {
            setNodes((nds) => nds.filter((n) => !selectedNodeIds.includes(n.id)));
            setEdges((eds) =>
              eds.filter(
                (edge) =>
                  !selectedNodeIds.includes(edge.source) &&
                  !selectedNodeIds.includes(edge.target) &&
                  !selectedEdgeIds.includes(edge.id)
              )
            );

            selectedNodeIds.forEach((id) => {
              const node = currentNodes.find((n) => n.id === id);
              logCanvasAction({
                actionId: "simulation-node-removed",
                displayName: `Removed ${node?.data?.label || "resource"} from simulation`,
                target: { resourceId: id, resourceName: node?.data?.label || id },
                metadata: { serviceId: node?.data?.serviceId },
              });
            });
          } else {
            setEdges((eds) => eds.filter((edge) => !selectedEdgeIds.includes(edge.id)));
          }

          selectedEdgeIds.forEach((id) => {
            const edge = currentEdges.find((e) => e.id === id);
            if (edge) {
              logCanvasAction({
                actionId: "simulation-edge-deleted",
                displayName: "Deleted connection",
                target: { resourceId: edge.id, resourceName: `${edge.source} to ${edge.target}` },
              });
            }
          });

          setSelectedNodeId(null);
        }
      }
      if (e.key === "Escape") {
        setSelectedNodeId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedNodeId, setNodes, setEdges, logCanvasAction, takeSnapshot]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    renderedNodes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    takeSnapshot,
    setReactFlowInstance,
    onNodeClick,
    onPaneClick,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    addNode,
    removeNode,
    addAnnotation,
    autoLayoutNodes,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
  };
}
