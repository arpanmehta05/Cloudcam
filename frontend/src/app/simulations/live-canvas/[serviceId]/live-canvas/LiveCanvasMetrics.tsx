import type { Node as FlowNode } from "reactflow";

type LiveCanvasMetricsProps = {
  selectedNode: FlowNode<any>;
};

export function LiveCanvasMetrics({ selectedNode }: LiveCanvasMetricsProps) {
  if (!selectedNode.data.metrics) return null;

  const rawState = selectedNode.data.item?.state;
  const stateStr = String((typeof rawState === 'object' ? rawState?.name : rawState) || selectedNode.data.item?.status || 'active').toLowerCase();
  const isStopped = ['stopped', 'terminated', 'stopping', 'shutting-down', 'deleted'].includes(stateStr);

  if (isStopped) return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Metrics</h3>
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground text-center">
         Metrics unavailable. Resource is currently {stateStr}.
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Metrics</h3>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(selectedNode.data.metrics).map(([key, val]) => (
          <div key={key} className="rounded-lg border border-border bg-muted/30 p-3">
            <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{key}</span>
            <span className="block font-semibold text-foreground truncate">{String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
