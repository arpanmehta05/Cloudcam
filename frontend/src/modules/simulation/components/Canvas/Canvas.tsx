"use client";

import React from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  SelectionMode,
  PanOnScrollMode,
  type OnConnect,
  type ReactFlowInstance,
  type Node as FlowNode,
  type Edge,
  type NodeTypes,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { Undo2, Redo2, Trash2, Keyboard } from "@/icons";
import { nodeTypes } from "./nodes";

const customNodeTypes: NodeTypes = nodeTypes;

interface CanvasProps {
  nodes: FlowNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: OnConnect;
  onNodeDragStart: () => void;
  onInit: (instance: ReactFlowInstance) => void;
  onNodeClick: (event: React.MouseEvent, node: FlowNode) => void;
  onPaneClick: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearCanvas: () => void;
  selectedNodeId: string | null;
}

export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDragStart,
  onInit,
  onNodeClick,
  onPaneClick,
  undo,
  redo,
  canUndo,
  canRedo,
  clearCanvas,
  selectedNodeId,
}: CanvasProps) {
  const isDoubleDraggingRef = React.useRef(false);

  React.useEffect(() => {
    const handleGlobalMouseDownCapture = (e: MouseEvent) => {
      if (e.detail >= 2) {
        const target = e.target as HTMLElement;
        if (target.classList.contains("react-flow__pane")) {
          isDoubleDraggingRef.current = true;
          Object.defineProperty(e, "shiftKey", { get: () => true, configurable: true });
        }
      }
    };

    const handleGlobalMouseMoveCapture = (e: MouseEvent) => {
      if (isDoubleDraggingRef.current) {
        Object.defineProperty(e, "shiftKey", { get: () => true, configurable: true });
      }
    };

    const handleGlobalMouseUpCapture = (e: MouseEvent) => {
      if (isDoubleDraggingRef.current) {
        isDoubleDraggingRef.current = false;
        Object.defineProperty(e, "shiftKey", { get: () => true, configurable: true });
      }

      // Keep the logic to clear selection marquee if mouse is released outside
      const container = document.querySelector(".react-flow");
      if (container && !container.contains(e.target as Node)) {
        const pane = container.querySelector(".react-flow__pane");
        if (pane) {
          pane.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
          pane.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        }
      }
    };

    const handleGlobalCancel = () => {
      isDoubleDraggingRef.current = false;
      const pane = document.querySelector(".react-flow__pane");
      if (pane) {
        pane.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        pane.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      }
    };

    window.addEventListener("mousedown", handleGlobalMouseDownCapture, true);
    window.addEventListener("mousemove", handleGlobalMouseMoveCapture, true);
    window.addEventListener("mouseup", handleGlobalMouseUpCapture, true);
    window.addEventListener("blur", handleGlobalCancel);
    document.addEventListener("mouseleave", handleGlobalCancel);

    return () => {
      window.removeEventListener("mousedown", handleGlobalMouseDownCapture, true);
      window.removeEventListener("mousemove", handleGlobalMouseMoveCapture, true);
      window.removeEventListener("mouseup", handleGlobalMouseUpCapture, true);
      window.removeEventListener("blur", handleGlobalCancel);
      document.removeEventListener("mouseleave", handleGlobalCancel);
    };
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={customNodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDragStart={onNodeDragStart}
      onInit={onInit}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      deleteKeyCode={null}
      panOnDrag={[1, 2]}
      selectionOnDrag={true}
      selectionKeyCode={null}
      selectionMode={SelectionMode.Partial}
      panActivationKeyCode="Space"
      panOnScroll={true}
      panOnScrollMode={PanOnScrollMode.Free}
      zoomOnPinch={true}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      defaultEdgeOptions={{
        animated: true,
        style: { stroke: "var(--primary)", strokeWidth: 2 },
      }}
      className="simulation-flow h-full w-full bg-transparent"
    >
      <Background color="hsl(var(--border))" gap={24} size={1} />
      <Controls className="rounded-lg! border! bg-card/90! text-foreground!" />
      <MiniMap
        position="bottom-left"
        className="rounded-lg! border! bg-card/90!"
        maskColor="rgba(0,0,0,0.15)"
      />

      {/* Bottom hint panel */}
      <Panel position="bottom-center" className="z-10! mb-3">
        <div className="simulation-card flex flex-wrap items-center gap-3 rounded-lg px-4 py-3">


          <div className="mr-1 flex items-center gap-1 border-r border-border pr-3">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs font-semibold text-foreground">
            {nodes.length === 0
              ? "Search above to add services - Space+drag or two-finger swipe to pan"
              : selectedNodeId
              ? "Press Delete to remove selected node"
              : "Left-click drag to select - Space+drag or two-finger swipe to pan"}
          </p>
          {nodes.length > 0 && (
            <button
              onClick={clearCanvas}
              className="simulation-action min-h-8 px-3 py-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
            <Keyboard className="h-3.5 w-3.5" />
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-1 dark:border-[#334155] dark:bg-[#07111F]">
                ⌘Z
              </kbd>{" "}
              undo
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-1 dark:border-[#334155] dark:bg-[#07111F]">
                ⌘Y
              </kbd>{" "}
              redo
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-1 dark:border-[#334155] dark:bg-[#07111F]">
                Del
              </kbd>{" "}
              remove
            </span>
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
}
