import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "@/icons";
import { logSimulationAction } from "@/lib/simulation-action-log";

type LiveCanvasRegionPanelProps = {
  isRegionPanelOpen: boolean;
  setIsRegionPanelOpen: (value: boolean) => void;
  serviceConfig?: { label?: string } | null;
  serviceId: string;
  allInventory: any[];
  regionCounts: Record<string, number>;
  viewRegion: string;
  setViewRegion: (value: string) => void;
  selectedProvider: string;
};

export function LiveCanvasRegionPanel({
  isRegionPanelOpen,
  setIsRegionPanelOpen,
  serviceConfig,
  serviceId,
  allInventory,
  regionCounts,
  viewRegion,
  setViewRegion,
  selectedProvider,
}: LiveCanvasRegionPanelProps) {
  return (
    <>
        {isRegionPanelOpen && (
          <div className="absolute top-0 right-0 z-50 h-full w-96 border-l border-border bg-card/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 transform translate-x-0 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <Badge variant="outline" className="mb-2 uppercase tracking-wider text-[10px] font-bold">
                  Region Selector
                </Badge>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  Global Inventory
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsRegionPanelOpen(false)} className="h-8 w-8 p-0 shrink-0">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 space-y-6">
               <p className="text-sm text-muted-foreground">
                 Select a region to filter the infrastructure canvas for <strong>{serviceConfig?.label}</strong>.
               </p>

               <div className="space-y-2">
                 <button
                    onClick={() => {
                      void logSimulationAction({
                        actionId: "live-region-filter-changed",
                        displayName: `Filtered live ${serviceConfig?.label || serviceId} canvas to all regions`,
                        status: "completed",
                        region: "all",
                        target: { resourceId: serviceId, resourceName: serviceConfig?.label || serviceId },
                        metadata: { resourceCount: allInventory.length, provider: selectedProvider },
                      });
                      setViewRegion("all");
                      setIsRegionPanelOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${viewRegion === "all" ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted/50 text-foreground"}`}
                 >
                    <span className="font-bold">ALL REGIONS</span>
                    <Badge variant={viewRegion === "all" ? "default" : "outline"}>{allInventory.length}</Badge>
                 </button>

                 <div className="pt-2">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Active Regions</h3>
                   <div className="space-y-1.5">
                     {Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).map(([r, count]) => (
                        <button
                          key={r}
                          onClick={() => {
                            void logSimulationAction({
                              actionId: "live-region-filter-changed",
                              displayName: `Filtered live ${serviceConfig?.label || serviceId} canvas to ${r}`,
                              status: "completed",
                              region: r,
                              target: { resourceId: serviceId, resourceName: serviceConfig?.label || serviceId },
                              metadata: { resourceCount: count, provider: selectedProvider },
                            });
                            setViewRegion(r);
                            setIsRegionPanelOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${viewRegion === r ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted/50 text-foreground"}`}
                        >
                          <span className="font-medium uppercase text-sm">{r}</span>
                          <Badge variant={viewRegion === r ? "default" : "secondary"}>{count}</Badge>
                        </button>
                     ))}
                   </div>
                 </div>
               </div>
            </div>
          </div>
        )}

    </>
  );
}
