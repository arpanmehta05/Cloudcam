import type { Node as FlowNode } from "reactflow";
import { ExternalLink } from "@/icons";
import { formatConfigKey } from "./liveCanvasHelpers";

type LiveCanvasResourceConfigProps = {
  selectedNode: FlowNode<any>;
};

export function LiveCanvasResourceConfig({ selectedNode }: LiveCanvasResourceConfigProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configuration</h3>
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-sm">
        {selectedNode.data.config && Object.entries(selectedNode.data.config).map(([key, val]) => {
          const formattedKey = formatConfigKey(key);
          const valStr = String(val);
          const isLongValue = valStr.length > 20 || valStr.includes("/") || valStr.includes(".");

           if (isLongValue) {
            const isUrlOrDomain = valStr.includes(".") && !valStr.includes(" ") && !valStr.includes(":");
            const hrefVal = valStr.startsWith("http") ? valStr : `https://${valStr}`;

            return (
              <div key={key} className="space-y-1 py-1 border-b border-border/30 last:border-0">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{formattedKey}</span>
                  {isUrlOrDomain && (
                    <a
                      href={hrefVal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" /> Open Link
                    </a>
                  )}
                </div>
                <span className="font-mono text-xs text-slate-100 break-all select-all block bg-slate-950 border border-slate-800 p-2 rounded leading-relaxed">{valStr}</span>
              </div>
            );
          }

          return (
            <div key={key} className="flex justify-between items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
              <span className="text-muted-foreground">{formattedKey}</span>
              <span className="font-semibold text-foreground text-right">{valStr}</span>
            </div>
          );
        })}
        {selectedNode.data.description && (
           <div className="flex justify-between items-center gap-2 pt-2 mt-2 border-t border-border/50">
              <span className="text-muted-foreground">Status / Date</span>
              <span className="font-semibold text-foreground text-right">{selectedNode.data.description}</span>
           </div>
        )}
      </div>
    </div>
  );
}
