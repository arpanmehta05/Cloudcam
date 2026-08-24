import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node as FlowNode,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import { nodeTypes, SERVICE_COLORS } from "@/modules/simulation";

type LiveCanvasFlowProps = {
  nodes: FlowNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeDragStart: () => void;
  onNodeDragStop: () => void;
  onNodeClick: (_: React.MouseEvent, node: FlowNode) => void;
  onPaneClick: () => void;
  isLayoutAnimating: boolean;
  isNodeDragging: boolean;
};

export function LiveCanvasFlow({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeDragStart,
  onNodeDragStop,
  onNodeClick,
  onPaneClick,
  isLayoutAnimating,
  isNodeDragging,
}: LiveCanvasFlowProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      className={[
        "live-canvas-flow",
        isLayoutAnimating ? "layout-animating" : "",
        isNodeDragging ? "is-node-dragging" : "",
      ].filter(Boolean).join(" ")}
      fitView
      attributionPosition="bottom-right"
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
    >
      <Background color="var(--border)" gap={16} size={1} />
      <Controls className="rounded-lg! border! bg-card/90! text-foreground!" />
      <MiniMap 
        nodeColor={(node) => {
            const colorKey = node.data?.serviceId;
            if (colorKey && SERVICE_COLORS[colorKey]) {
              return SERVICE_COLORS[colorKey].accent;
            }
            return "var(--muted-foreground)";
        }}
        maskColor="var(--background)"
        className="bg-background/80 border border-border rounded-xl shadow-lg backdrop-blur-xl"
      />
    </ReactFlow>
  );
}
