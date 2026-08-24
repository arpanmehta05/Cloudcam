import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Edge, Node as FlowNode } from "reactflow";
import { LIVE_CANVAS_LAYOUT_ANIMATION_SETTLE_MS } from "./liveCanvasHelpers";

type UseLiveCanvasEcrExpansionParams = {
  nodes: FlowNode[];
  region: string;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
};

export function useLiveCanvasEcrExpansion({
  nodes,
  region,
  setNodes,
  setEdges,
}: UseLiveCanvasEcrExpansionParams) {
  const [expandedRepoId, setExpandedRepoId] = useState<string | null>(null);
  const [isLayoutAnimating, setIsLayoutAnimating] = useState(false);

  const nodesRef = useRef<FlowNode[]>([]);
  const expandedRepoIdRef = useRef<string | null>(null);
  const layoutAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (layoutAnimationTimerRef.current) {
        clearTimeout(layoutAnimationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    expandedRepoIdRef.current = expandedRepoId;
  }, [expandedRepoId]);

  const animateNodes = useCallback((
    targetPositions: Record<string, { x: number; y: number }>,
    nodeDataUpdates?: Record<string, any>,
    onComplete?: () => void,
    nodeClassNameUpdates?: Record<string, string>
  ) => {
    if (layoutAnimationTimerRef.current) {
      clearTimeout(layoutAnimationTimerRef.current);
    }

    setIsLayoutAnimating(true);
    setNodes((currentNodes) => {
      return currentNodes.map((n) => {
        const target = targetPositions[n.id];
        const updates = nodeDataUpdates?.[n.id];
        const className = nodeClassNameUpdates?.[n.id];

        if (!target && !updates && className === undefined) return n;

        return {
          ...n,
          ...(target ? { position: target } : {}),
          ...(updates ? { data: { ...n.data, ...updates } } : {}),
          ...(className !== undefined ? { className } : {}),
        };
      });
    });

    layoutAnimationTimerRef.current = setTimeout(() => {
      setIsLayoutAnimating(false);
      layoutAnimationTimerRef.current = null;
      onComplete?.();
    }, LIVE_CANVAS_LAYOUT_ANIMATION_SETTLE_MS);
  }, [setNodes]);

  const collapseRepoImages = useCallback(() => {
    const currentNodes = nodesRef.current;
    let parentNodeId: string | null = null;
    let parentX = 500;
    let parentY = 400;

    const parentNode = currentNodes.find((n) => n.data?.serviceId === "ecr" && n.data?.isExpanded);
    if (parentNode) {
      parentNodeId = parentNode.id;
      parentX = parentNode.position.x;
      parentY = parentNode.position.y;
    }

    const hasExpandedCanvas =
      Boolean(parentNodeId) ||
      currentNodes.some((n) => n.id.startsWith("ecr_image_") || n.data?.shiftedX);

    expandedRepoIdRef.current = null;
    setExpandedRepoId(null);

    if (!hasExpandedCanvas) return;

    const targetPositions: Record<string, { x: number; y: number }> = {};
    const nodeDataUpdates: Record<string, any> = {};
    const nodeClassNameUpdates: Record<string, string> = {};

    currentNodes.forEach((n) => {
      if (n.data?.shiftedX) {
        targetPositions[n.id] = { x: n.position.x - n.data.shiftedX, y: n.position.y };
        nodeDataUpdates[n.id] = { shiftedX: undefined };
      }
      if (n.id.startsWith("ecr_image_") && parentNodeId) {
        targetPositions[n.id] = { x: parentX, y: parentY };
        nodeClassNameUpdates[n.id] = "live-canvas-ecr-image-node live-canvas-node-exiting";
      }
    });

    setNodes(
      currentNodes.map((n) => {
        if (n.data?.serviceId === "ecr" && n.data?.isExpanded) {
          return {
            ...n,
            className: "live-canvas-node-collapsing",
            data: { ...n.data, isExpanded: false },
          };
        }
        return n;
      })
    );

    requestAnimationFrame(() => {
      animateNodes(targetPositions, nodeDataUpdates, () => {
        setNodes((nds) => nds.filter((n) => !n.id.startsWith("ecr_image_")));
        setEdges((eds) => eds.filter((e) => !e.id.startsWith("edge-ecr-image-")));
      }, nodeClassNameUpdates);
    });
  }, [animateNodes, setNodes, setEdges]);

  const toggleRepoImages = useCallback((nodeId: string, images: any[], parentX: number, parentY: number) => {
    const currentNodes = nodesRef.current;
    const isCurrentlyExpanded =
      expandedRepoIdRef.current === nodeId ||
      currentNodes.some((n) => n.id === nodeId && n.data?.isExpanded);

    if (isCurrentlyExpanded) {
      collapseRepoImages();
      return;
    }

    expandedRepoIdRef.current = nodeId;
    setExpandedRepoId(nodeId);

    // First restore any shifted nodes instantly.
    const restored = currentNodes.map((n) => {
      if (n.data?.shiftedX) {
        return {
          ...n,
          position: { ...n.position, x: n.position.x - n.data.shiftedX },
          data: { ...n.data, shiftedX: undefined },
        };
      }
      return n;
    });

    // Filter out child nodes instantly.
    const filtered = restored.filter((n) => !n.id.startsWith("ecr_image_"));

    const updated = filtered.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          className: "live-canvas-node-expanded",
          data: { ...n.data, isExpanded: true },
        };
      }
      if (n.data?.serviceId === "ecr" && n.id !== nodeId) {
        return {
          ...n,
          className: undefined,
          data: { ...n.data, isExpanded: false },
        };
      }
      return n;
    });

    const newImageNodes: FlowNode[] = [];
    images.forEach((img: any) => {
      const imgNodeId = `ecr_image_${nodeId}_${img.digest}`;
      const tagLabel = img.tags && img.tags.length > 0 ? img.tags[0] : `${img.digest.substring(0, 12)}...`;
      const allTags = img.tags && img.tags.length > 0 ? img.tags.join(", ") : "untagged";
      const sizeMB = img.size ? `${(img.size / (1024 * 1024)).toFixed(2)} MB` : "N/A";
      const dateStr = img.pushedAt ? new Date(img.pushedAt).toLocaleString() : "N/A";

      newImageNodes.push({
        id: imgNodeId,
        type: "service",
        position: { x: parentX, y: parentY },
        className: "live-canvas-ecr-image-node live-canvas-node-entering",
        data: {
          serviceId: "ecr_image",
          label: tagLabel,
          description: `Digest: ${img.digest.substring(0, 20)}...\nSize: ${sizeMB}\nPushed: ${dateStr}\nTags: ${allTags}`,
          colorKey: "ecr",
          icon: "Container",
          item: {
            id: img.digest,
            name: tagLabel,
            digest: img.digest,
            tags: allTags,
            repositoryName: nodeId.replace("ecr_", ""),
            region: region
          },
          config: {
            digest: img.digest,
            tags: allTags,
            size: sizeMB,
            pushedAt: dateStr,
            repositoryName: nodeId.replace("ecr_", "")
          }
        }
      });
    });

    const numImages = images.length;
    const minY = parentY - ((numImages - 1) / 2) * 145;
    const maxY = parentY + ((numImages - 1) / 2) * 145 + 120;

    const targetPositions: Record<string, { x: number; y: number }> = {};
    const nodeDataUpdates: Record<string, any> = {};
    const nodeClassNameUpdates: Record<string, string> = {};

    updated.forEach((n) => {
      if (n.id !== nodeId && !n.id.startsWith("ecr_image_") && n.position.x > parentX + 150) {
        const nodeHeight = 120;
        const overlapsY = (n.position.y + nodeHeight > minY - 50) && (n.position.y < maxY + 50);
        if (overlapsY) {
          targetPositions[n.id] = { x: n.position.x + 360, y: n.position.y };
          nodeDataUpdates[n.id] = { shiftedX: 360 };
        }
      }
    });

    newImageNodes.forEach((imgNode, idx) => {
      const childX = parentX + 340;
      const childY = parentY + (idx - (numImages - 1) / 2) * 145;
      targetPositions[imgNode.id] = { x: childX, y: childY };
      nodeClassNameUpdates[imgNode.id] = "live-canvas-ecr-image-node live-canvas-node-entered";
    });

    setNodes([...updated, ...newImageNodes]);
    setEdges((eds) => {
      const newEdges = eds.filter((e) => !e.id.startsWith("edge-ecr-image-"));
      images.forEach((img: any) => {
        newEdges.push({
          id: `edge-ecr-image-${nodeId}-${img.digest}`,
          source: nodeId,
          target: `ecr_image_${nodeId}_${img.digest}`,
          type: "smoothstep",
          animated: true,
          className: "live-canvas-ecr-edge",
          style: { stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: "5,5" },
        });
      });
      return newEdges;
    });

    requestAnimationFrame(() => {
      animateNodes(targetPositions, nodeDataUpdates, undefined, nodeClassNameUpdates);
    });
  }, [region, collapseRepoImages, animateNodes, setNodes, setEdges]);

  const resetExpandedRepo = useCallback(() => {
    expandedRepoIdRef.current = null;
    setExpandedRepoId(null);
  }, []);

  return {
    expandedRepoId,
    isLayoutAnimating,
    collapseRepoImages,
    resetExpandedRepo,
    toggleRepoImages,
  };
}
