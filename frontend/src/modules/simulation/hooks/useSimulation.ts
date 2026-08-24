"use client";

import { useCallback } from "react";
import type { Node as FlowNode } from "reactflow";
import type { ServiceNodeData } from "../components/Canvas/nodes";
import { useSimulationGraph } from "./useSimulationGraph";
import { useSimulationDeploy } from "./useSimulationDeploy";

export function useSimulation() {
  // 1. We manage basic node and edge arrays inside useSimulation Deploy which coordinates saving
  // but to avoid circular dependencies, we declare sets here or delegate them to deploy.
  const deploy = useSimulationDeploy({
    nodes: [],
    edges: [],
    setNodes: () => {},
    setEdges: () => {},
  });

  // To wire them together, we override the empty setNodes/setEdges of deploy:
  const graph = useSimulationGraph({
    activeServiceProvider: deploy.activeServiceProvider,
    pickerProvider: deploy.pickerProvider,
    deploymentId: deploy.deploymentId,
    logCanvasAction: deploy.logCanvasAction,
    name: deploy.name,
  });

  // Make sure deploy uses the live arrays
  const deployNodes = graph.nodes;
  const deployEdges = graph.edges;
  
  // Create a customized deploy hook that is fed with graph nodes and edges
  const deployInstance = useSimulationDeploy({
    nodes: deployNodes,
    edges: deployEdges,
    setNodes: graph.setNodes,
    setEdges: graph.setEdges,
  });

  const handleConfigSave = useCallback(
    (updates: Partial<ServiceNodeData>) => {
      if (!graph.selectedNodeId) return;
      graph.setNodes((nds) =>
        nds.map((n) =>
          n.id === graph.selectedNodeId
            ? { ...n, data: { ...n.data, ...updates } as ServiceNodeData }
            : n,
        ),
      );
      deployInstance.logCanvasAction({
        actionId: "simulation-node-configured",
        displayName: `Updated ${graph.selectedNode?.data?.label || "resource"} configuration`,
        target: { resourceId: graph.selectedNodeId, resourceName: graph.selectedNode?.data?.label || graph.selectedNodeId },
        metadata: { updates },
      });
      graph.setSelectedNodeId(null);
    },
    [graph, deployInstance],
  );

  const handleConfigClose = useCallback(() => {
    graph.setSelectedNodeId(null);
  }, [graph]);

  const errorMessage = deployInstance.session?.errorMessage || "Something went wrong starting the simulation.";

  return {
    session: deployInstance.session,
    phase: deployInstance.phase,
    startSimulationSession: deployInstance.startSimulationSession,
    handleCancelSimulation: deployInstance.handleCancelSimulation,
    errorMessage,
    loaderSteps: deployInstance.loaderSteps,
    completedStepCount: deployInstance.completedStepCount,
    name: deployInstance.name,
    setName: deployInstance.setName,
    draftId: deployInstance.draftId,
    deploymentId: deployInstance.deploymentId,
    setDeploymentId: deployInstance.setDeploymentId,
    syncState: deployInstance.syncState,
    handleManualSave: deployInstance.handleManualSave,
    
    nodes: graph.nodes,
    setNodes: graph.setNodes,
    edges: graph.edges,
    setEdges: graph.setEdges,
    renderedNodes: graph.renderedNodes,
    onNodesChange: graph.onNodesChange,
    onEdgesChange: graph.onEdgesChange,
    onConnect: graph.onConnect,
    takeSnapshot: graph.takeSnapshot,
    setReactFlowInstance: graph.setReactFlowInstance,
    onNodeClick: graph.onNodeClick,
    onPaneClick: graph.onPaneClick,
    undo: graph.undo,
    redo: graph.redo,
    canUndo: graph.canUndo,
    canRedo: graph.canRedo,
    clearCanvas: graph.clearCanvas,
    addNode: graph.addNode,
    removeNode: graph.removeNode,
    addAnnotation: graph.addAnnotation,
    autoLayoutNodes: graph.autoLayoutNodes,
    selectedNodeId: graph.selectedNodeId,
    selectedNode: graph.selectedNode,
    
    showTerraform: deployInstance.showTerraform,
    handleOpenTerraform: deployInstance.handleOpenTerraform,
    handleCloseTerraform: () => deployInstance.setShowTerraform(false),
    showDeploy: deployInstance.showDeploy,
    handleOpenDeploy: deployInstance.handleOpenDeploy,
    handleCloseDeploy: () => deployInstance.setShowDeploy(false),
    pickerProvider: deployInstance.pickerProvider,
    setPickerProvider: deployInstance.setPickerProvider,
    derivedRegion: deployInstance.derivedRegion,
    derivedProvider: deployInstance.derivedProvider,
    activeServiceProvider: deployInstance.activeServiceProvider,
    simulation: deployInstance.simulation,
    
    handleConfigSave,
    handleConfigClose,
  };
}
