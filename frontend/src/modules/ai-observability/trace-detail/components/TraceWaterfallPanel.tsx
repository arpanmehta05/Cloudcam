"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  PanOnScrollMode,
  Position,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, GitBranch, Network } from "@/icons";
import type { AiTraceSpan } from "../api";
import { TraceSpanTree } from "./TraceSpanTree";

interface TraceWaterfallPanelProps {
  spans: AiTraceSpan[];
  selectedId?: string;
  onSelect: (span: AiTraceSpan) => void;
}

function traceBounds(spans: AiTraceSpan[]) {
  const starts = spans.map((span) => new Date(span.startedAt).getTime());
  const ends = spans.map((span) => new Date(span.endedAt || span.startedAt).getTime());
  const start = Math.min(...starts);
  return { start, total: Math.max(1, Math.max(...ends) - start) };
}

/** Horizontal duration bars (Gantt). */
function Waterfall({ spans, selectedId, onSelect }: TraceWaterfallPanelProps) {
  const base = useMemo(() => traceBounds(spans), [spans]);
  return (
    <div className="space-y-2">
      {spans.map((span) => {
        const left = ((new Date(span.startedAt).getTime() - base.start) / base.total) * 100;
        const width = Math.max(4, ((span.durationMs || 1) / base.total) * 100);
        const ttftLeft = span.completionStartTime
          ? ((new Date(span.completionStartTime).getTime() - base.start) / base.total) * 100
          : null;
        return (
          <button
            key={span.spanId}
            onClick={() => onSelect(span)}
            className={`grid w-full gap-3 rounded-md border p-2 text-left transition md:grid-cols-[210px_1fr_80px] ${
              selectedId === span.spanId ? "border-primary bg-primary/5" : "hover:bg-secondary/30"
            }`}
            type="button"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{span.name}</p>
              <p className="text-[11px] text-muted-foreground">{span.kind} / {span.modelName || span.provider || "custom"}</p>
            </div>
            <div className="relative h-7 rounded bg-secondary">
              <div
                className="absolute top-1.5 h-4 rounded bg-primary shadow-sm"
                style={{ left: `${Math.min(left, 96)}%`, width: `${Math.min(width, Math.max(4, 100 - left))}%` }}
              />
              {ttftLeft !== null ? <div className="absolute top-0 h-7 w-px bg-amber-400" style={{ left: `${Math.min(ttftLeft, 98)}%` }} /> : null}
            </div>
            <span className="font-mono text-xs text-muted-foreground">{span.durationMs || 0}ms</span>
          </button>
        );
      })}
    </div>
  );
}

interface GraphNode {
  span: AiTraceSpan;
  depth: number;
  hasChildren: boolean;
}

/** Flatten spans into a depth-annotated node order following parentSpanId. */
function buildGraph(spans: AiTraceSpan[]): GraphNode[] {
  const byParent = new Map<string, AiTraceSpan[]>();
  const ids = new Set(spans.map((span) => span.spanId));
  for (const span of spans) {
    const parent = span.parentSpanId && ids.has(span.parentSpanId) ? span.parentSpanId : "__root__";
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(span);
  }
  const out: GraphNode[] = [];
  const visited = new Set<string>();
  const walk = (parentKey: string, depth: number) => {
    for (const span of byParent.get(parentKey) || []) {
      if (visited.has(span.spanId)) continue;
      visited.add(span.spanId);
      out.push({ span, depth, hasChildren: byParent.has(span.spanId) });
      walk(span.spanId, depth + 1);
    }
  };
  walk("__root__", 0);
  // Any spans not reached (cyclic/orphan) are appended at depth 0.
  for (const span of spans) {
    if (!visited.has(span.spanId)) out.push({ span, depth: 0, hasChildren: false });
  }
  return out;
}

function kindColor(kind: string): string {
  if (kind === "generation" || kind === "llm") return "bg-primary";
  if (kind === "retrieval") return "bg-emerald-500";
  if (kind === "embedding") return "bg-orange-500";
  if (kind === "tool" || kind === "agent") return "bg-amber-500";
  if (kind === "event") return "bg-sky-500";
  return "bg-muted-foreground";
}

/** Border color (hex) for a flow-graph node, mirroring kindColor. */
function kindHex(kind: string): string {
  if (kind === "generation" || kind === "llm") return "#8b5cf6";
  if (kind === "retrieval") return "#10b981";
  if (kind === "embedding") return "#f97316";
  if (kind === "tool" || kind === "agent") return "#f59e0b";
  if (kind === "event") return "#0ea5e9";
  return "#3b82f6";
}

/** Indented tree following parentSpanId. */
function Tree({ spans, selectedId, onSelect }: TraceWaterfallPanelProps) {
  const nodes = useMemo(() => buildGraph(spans), [spans]);
  return (
    <div className="space-y-1">
      {nodes.map(({ span, depth, hasChildren }) => (
        <button
          key={span.spanId}
          type="button"
          onClick={() => onSelect(span)}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          className={`flex w-full items-center gap-2 rounded-md border py-1.5 pr-2 text-left transition ${
            selectedId === span.spanId ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary/30"
          }`}
        >
          {depth > 0 && <span className="font-mono text-[10px] text-muted-foreground">└─</span>}
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${kindColor(span.kind)}`} />
          <span className="truncate text-sm font-medium">{span.name}</span>
          <span className="ml-auto flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
            {hasChildren && <GitBranch className="h-3 w-3" />}
            <span className="font-mono">{span.durationMs || 0}ms</span>
          </span>
        </button>
      ))}
    </div>
  );
}

const NODE_WIDTH = 200;
const NODE_GAP_X = 28;
const ROW_GAP = 104;
const LEAF_STRIDE = NODE_WIDTH + NODE_GAP_X;
const EDGE_STROKE = "#94a3b8";

const START_ID = "__start__";
const END_ID = "__end__";

/** A tidy top-down tree layout (children centered under their parent), following
 *  parentSpanId — the same shape Langfuse renders. Returns center-x per span. */
function layoutTree(spans: AiTraceSpan[]) {
  const ids = new Set(spans.map((s) => s.spanId));
  const children = new Map<string, AiTraceSpan[]>();
  const roots: AiTraceSpan[] = [];
  for (const span of spans) {
    if (span.parentSpanId && ids.has(span.parentSpanId)) {
      if (!children.has(span.parentSpanId)) children.set(span.parentSpanId, []);
      children.get(span.parentSpanId)!.push(span);
    } else {
      roots.push(span);
    }
  }

  const centerX = new Map<string, number>();
  const depthOf = new Map<string, number>();
  const leaves: string[] = [];
  let cursor = 0;
  const seen = new Set<string>();

  const place = (span: AiTraceSpan, depth: number): number => {
    if (seen.has(span.spanId)) return centerX.get(span.spanId) ?? 0;
    seen.add(span.spanId);
    depthOf.set(span.spanId, depth);
    const kids = children.get(span.spanId) || [];
    let x: number;
    if (kids.length === 0) {
      x = cursor * LEAF_STRIDE;
      cursor += 1;
      leaves.push(span.spanId);
    } else {
      const childCenters = kids.map((kid) => place(kid, depth + 1));
      x = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    }
    centerX.set(span.spanId, x);
    return x;
  };

  const rootCenters = roots.map((root) => place(root, 1));
  // Any spans not reached (orphans/cycles) are dropped into their own leaf row.
  for (const span of spans) {
    if (!seen.has(span.spanId)) {
      seen.add(span.spanId);
      depthOf.set(span.spanId, 1);
      centerX.set(span.spanId, cursor * LEAF_STRIDE);
      cursor += 1;
      leaves.push(span.spanId);
      rootCenters.push(centerX.get(span.spanId)!);
    }
  }

  const maxDepth = Math.max(1, ...Array.from(depthOf.values()));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    centerX,
    depthOf,
    leaves,
    startX: avg(rootCenters),
    endX: avg(leaves.map((id) => centerX.get(id) || 0)),
    endDepth: maxDepth + 1,
    roots: roots.map((r) => r.spanId),
  };
}

function endpointNode(id: string, label: string, x: number, y: number, color: string): Node {
  return {
    id,
    position: { x: x - 40, y },
    data: { label: <span className="text-xs font-semibold">{label}</span> },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    selectable: false,
    style: {
      width: 80,
      textAlign: "center",
      borderRadius: 8,
      padding: 6,
      border: `1.5px solid ${color}`,
      background: color,
      color: "#fff",
    },
  };
}

/** Langfuse-style flow chart: a centered top-down tree with __start__/__end__
 *  bookend nodes and orthogonal (smoothstep) arrows following parentSpanId. */
function FlowGraph({ spans, selectedId, onSelect }: TraceWaterfallPanelProps) {
  const byId = useMemo(() => new Map(spans.map((span) => [span.spanId, span])), [spans]);

  const { nodes, edges } = useMemo(() => {
    const layout = layoutTree(spans);

    const graphNodes: Node[] = spans.map((span) => {
      const hex = kindHex(span.kind);
      const active = selectedId === span.spanId;
      const cx = layout.centerX.get(span.spanId) ?? 0;
      const depth = layout.depthOf.get(span.spanId) ?? 1;
      return {
        id: span.spanId,
        position: { x: cx - NODE_WIDTH / 2, y: depth * ROW_GAP },
        data: {
          label: (
            <div className="flex items-start gap-2 text-left">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${kindColor(span.kind)}`} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{span.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {span.kind} / {span.modelName || span.provider || "custom"}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">{span.durationMs || 0}ms</p>
              </div>
            </div>
          ),
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: {
          width: NODE_WIDTH,
          borderRadius: 10,
          padding: 8,
          borderWidth: active ? 2 : 1.5,
          borderStyle: "solid",
          borderColor: hex,
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          boxShadow: active ? `0 0 0 2px ${hex}55` : undefined,
        },
      };
    });

    graphNodes.push(endpointNode(START_ID, "__start__", layout.startX, 0, "#16a34a"));
    graphNodes.push(endpointNode(END_ID, "__end__", layout.endX, layout.endDepth * ROW_GAP, "#dc2626"));

    const ids = new Set(spans.map((span) => span.spanId));
    const graphEdges: Edge[] = [];
    // __start__ -> each root
    for (const rootId of layout.roots) {
      graphEdges.push({ id: `${START_ID}->${rootId}`, source: START_ID, target: rootId });
    }
    // parent -> child
    for (const span of spans) {
      if (span.parentSpanId && ids.has(span.parentSpanId)) {
        graphEdges.push({ id: `${span.parentSpanId}->${span.spanId}`, source: span.parentSpanId, target: span.spanId });
      }
    }
    // each leaf -> __end__
    for (const leafId of layout.leaves) {
      graphEdges.push({ id: `${leafId}->${END_ID}`, source: leafId, target: END_ID });
    }

    return { nodes: graphNodes, edges: graphEdges };
  }, [spans, selectedId]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      const span = byId.get(node.id);
      if (span) onSelect(span);
    },
    [byId, onSelect],
  );

  return (
    <div className="h-125 w-full overflow-hidden rounded-md border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesConnectable={false}
        nodesDraggable={false}
        // Trackpad-friendly: two-finger scroll pans the canvas; pinch (or
        // ctrl/⌘ + scroll) zooms. Click-drag on empty space still pans too.
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnPinch
        panOnDrag
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_STROKE },
          style: { stroke: EDGE_STROKE, strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function TraceWaterfallPanel(props: TraceWaterfallPanelProps) {
  return (
    <Card className="rounded-lg">
      <Tabs defaultValue="tree">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" />Trace Map</CardTitle>
          <TabsList className="h-8">
            <TabsTrigger value="tree" className="text-xs"><GitBranch className="h-3.5 w-3.5" />Tree</TabsTrigger>
            <TabsTrigger value="waterfall" className="text-xs"><GitBranch className="h-3.5 w-3.5" />Waterfall</TabsTrigger>
            <TabsTrigger value="graph" className="text-xs"><Network className="h-3.5 w-3.5" />Graph</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs"><Clock className="h-3.5 w-3.5" />Timeline</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          {!props.spans.length ? (
            <p className="text-sm text-muted-foreground">No spans captured.</p>
          ) : (
            <>
            {/* Tree tab -> span list tree; Waterfall tab -> nested tree; Graph tab -> flow chart; Timeline tab -> duration bars. */}
            <TabsContent value="tree"><TraceSpanTree {...props} /></TabsContent>
            <TabsContent value="waterfall"><Tree {...props} /></TabsContent>
            <TabsContent value="graph"><FlowGraph {...props} /></TabsContent>
            <TabsContent value="timeline"><Waterfall {...props} /></TabsContent>
            </>
          )}
        </CardContent>
      </Tabs>
    </Card>
  );
}
