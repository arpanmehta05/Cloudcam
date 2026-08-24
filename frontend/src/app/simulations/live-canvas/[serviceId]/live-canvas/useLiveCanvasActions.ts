import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Node as FlowNode } from "reactflow";
import { authFetch } from "@/lib/auth-fetch";
import { logSimulationAction } from "@/lib/simulation-action-log";

type ActionPayload = { action: string; label: string; region: string } | null;

type UseLiveCanvasActionsParams = {
  selectedNode: FlowNode | null;
  setSelectedNode: Dispatch<SetStateAction<FlowNode | null>>;
  selectedProvider: string;
  region: string;
  serviceId: string;
  nodes: FlowNode[];
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  lambdaCode: string | null;
  setIsCodeDirty: (value: boolean) => void;
};

export function useLiveCanvasActions({
  selectedNode,
  setSelectedNode,
  selectedProvider,
  region,
  serviceId,
  nodes,
  setNodes,
  lambdaCode,
  setIsCodeDirty,
}: UseLiveCanvasActionsParams) {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionPayload, setActionPayload] = useState<ActionPayload>(null);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [deployCodeModalOpen, setDeployCodeModalOpen] = useState(false);

  const confirmCodeDeployment = async () => {
    if (!selectedNode || lambdaCode === null) return;
    setIsActionLoading(true);
    try {
      const resourceId = selectedNode.data.item ? (selectedNode.data.item.arn || selectedNode.data.item.id || selectedNode.data.item.name) : selectedNode.id;
      const resourceRegion = selectedNode.data.item?.region || region;

      setActionPayload({
        action: "update-code",
        label: selectedNode.data.label,
        region: resourceRegion
      });

      const res = await authFetch(`/api/${selectedProvider}/resources/${encodeURIComponent(resourceId)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-code",
          service: "lambda",
          region: resourceRegion,
          code: lambdaCode
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to initiate code update.");
      }

      setIsCodeDirty(false);
      setActiveDeploymentId(data.deploymentId);
      
      void logSimulationAction({
        actionId: "live-lambda-code-updated",
        displayName: `Updated Lambda function code for ${selectedNode.data.label}`,
        status: "simulated",
        region: resourceRegion,
        target: {
          resourceId: resourceId || selectedNode.id,
          resourceName: selectedNode.data.label,
        },
        metadata: { action: "update-code", serviceId, deploymentId: data.deploymentId, provider: selectedProvider },
      });

      setDeployCodeModalOpen(false);
    } catch (err: any) {
      console.error("Failed to deploy code:", err);
      alert(err.message || "Failed to deploy code changes.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const openActionModal = (action: string) => {
    if (!selectedNode) return;
    
    // Capture specific region from node data
    const resourceRegion = selectedNode.data.item?.region || region;
    
    setActionPayload({ 
      action, 
      label: selectedNode.data.label,
      region: resourceRegion
    });
    setSelectedInstanceId("");
    setActionModalOpen(true);
    void logSimulationAction({
      actionId: "live-action-confirmation-opened",
      displayName: `Opened ${action} confirmation for ${selectedNode.data.label}`,
      status: "simulated",
      region: resourceRegion,
      target: {
        resourceId: selectedNode.data.item?.id || selectedNode.data.item?.name || selectedNode.id,
        resourceName: selectedNode.data.label,
      },
      metadata: { action, serviceId, provider: selectedProvider },
    });
  };

  const confirmNodeAction = async () => {
    if (!selectedNode || !actionPayload) return;
    if (selectedProvider !== "aws" && selectedProvider !== "azure" && selectedProvider !== "gcp") {
      alert(`${String(selectedProvider).toUpperCase()} live actions are not enabled yet. The ${String(selectedProvider).toUpperCase()} canvas is read-only in this phase.`);
      setActionModalOpen(false);
      return;
    }

    setIsActionLoading(true);
    try {
      console.log(`Action ${actionPayload.action} triggered for ${actionPayload.label}`);
      
       let manifestListDigest = undefined;
       if (selectedNode.data.serviceId === 'ecr_image' && actionPayload.action === 'unarchive') {
         const repoName = selectedNode.data.item?.repositoryName;
         const repoNode = nodes.find(
           n => n.data?.serviceId === 'ecr' && n.data?.item?.name === repoName
         );
         const allImages = repoNode?.data?.images || [];
         const activeImg = allImages.find((img: any) => 
           img.digest !== selectedNode.data.item?.digest && 
           img.tags && 
           img.tags.length > 0 && 
           !img.tags.some((t: string) => t === 'archived' || t.startsWith('archived-'))
         );
         manifestListDigest = activeImg?.digest;
       }

       const resourceId = selectedNode.data.item ? (selectedNode.data.item.arn || selectedNode.data.item.id || selectedNode.data.item.name) : selectedNode.id;
       const res = await authFetch(`/api/${selectedProvider}/resources/${encodeURIComponent(resourceId)}/action`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ 
           action: actionPayload.action, 
           service: selectedNode.data.serviceId || serviceId, 
           region: actionPayload.region,
           isSnapshot: selectedNode.data.item?.type === "snapshot",
           associationId: selectedNode.data.item?.associationId,
           instanceId: selectedInstanceId || undefined,
           repositoryName: selectedNode.data.item?.repositoryName || undefined,
           tags: selectedNode.data.item?.tags || undefined,
           manifestListDigest,
           apiType: selectedNode.data.item?.apiType || undefined,
         })
       });

       const data = await res.json();
       
       if (!data.success) {
          throw new Error(data.error || "Failed to initiate action.");
       }

       // Update local node state immediately to reflect the transitioning state
       const targetStateMap: Record<string, string> = {
         start: "starting",
         stop: "stopping",
         restart: "restarting",
         terminate: "deleting",
         delete: "deleting",
         disassociate: "disassociating",
         release: "releasing",
         associate: "associating",
       };
       const nextStatus = targetStateMap[actionPayload.action] || "updating";

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === selectedNode.id) {
            const updatedItem = {
              ...(node.data?.item || {}),
              status: nextStatus,
              state: nextStatus,
            };
            return {
              ...node,
              data: {
                ...node.data,
                item: updatedItem,
              },
            };
          }
          return node;
        })
      );

      setSelectedNode((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          data: {
            ...prev.data,
            item: {
              ...(prev.data?.item || {}),
              status: nextStatus,
              state: nextStatus,
            },
          },
        };
      });

      // Instead of alert, we trigger the live action deployment panel
      setActiveDeploymentId(data.deploymentId);
      void logSimulationAction({
        actionId: "live-action-prepared",
        displayName: `Prepared ${actionPayload.action} action for ${actionPayload.label}`,
        status: "simulated",
        region: actionPayload.region,
        target: {
          resourceId: resourceId || selectedNode.id,
          resourceName: actionPayload.label,
        },
        metadata: { action: actionPayload.action, serviceId, deploymentId: data.deploymentId, provider: selectedProvider },
      });
      setActionModalOpen(false);
    } catch (err: any) {
      console.error(`Failed to execute ${actionPayload.action}:`, err);
      void logSimulationAction({
        actionId: "live-action-prepare-failed",
        displayName: `Failed to prepare ${actionPayload.action} action for ${actionPayload.label}`,
        status: "failed",
        region: actionPayload.region,
        target: {
          resourceId: selectedNode.data.item?.id || selectedNode.data.item?.name || selectedNode.id,
          resourceName: actionPayload.label,
        },
        reasoning: err.message || `Failed to execute ${actionPayload.action}`,
        metadata: { action: actionPayload.action, serviceId, provider: selectedProvider },
      });
      alert(err.message || `Failed to execute ${actionPayload.action}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  return {
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
  };
}
