import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Activity, ArrowLeft, RefreshCw } from "@/icons";
import { logSimulationAction } from "@/lib/simulation-action-log";
import { SERVICE_REGISTRY } from "@/lib/services/registry";
import { inventoryKeyForService } from "./liveCanvasHelpers";

type LiveCanvasTopbarProps = {
  serviceConfig?: { label?: string } | null;
  serviceId: string;
  lastUpdated: string | null;
  selectedProvider: string;
  viewRegion: string;
  allInventory: any[];
  fetchInventory: (forceRefresh?: boolean) => void;
  loading: boolean;
};

export function LiveCanvasTopbar({
  serviceConfig,
  serviceId,
  lastUpdated,
  selectedProvider,
  viewRegion,
  allInventory,
  fetchInventory,
  loading,
}: LiveCanvasTopbarProps) {
  return (
      <header className="simulation-topbar relative z-10 grid shrink-0 grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-3 lg:items-center lg:px-6">
          <div className="flex items-center justify-start">
            <Link
              href="/simulations/live-canvas"
              className="simulation-action min-h-9 px-3 py-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>

          <div className="flex flex-col items-center justify-center">
            <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-foreground">
              <Activity className="h-5 w-5 text-primary" />
              {serviceConfig ? serviceConfig.label : "Service"} Group
            </h1>
            {lastUpdated && (
              <p className="mt-1 text-xs text-muted-foreground">
                Last synced at {lastUpdated}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
             <ThemeToggle />
             <Badge variant="outline" className="border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary uppercase">
                {selectedProvider} / {viewRegion}
             </Badge>
             {SERVICE_REGISTRY[inventoryKeyForService(serviceId)] && (
               <Link href={`/dashboards/${inventoryKeyForService(serviceId)}`}>
                 <Button variant="outline" className="simulation-action h-9 font-medium">
                   View All
                 </Button>
               </Link>
             )}
             <Button
              variant="outline"
              onClick={() => {
                void logSimulationAction({
                  actionId: "live-service-canvas-synced",
                  displayName: `Synced live ${serviceConfig?.label || serviceId} canvas`,
                  status: "completed",
                  region: viewRegion,
                  target: { resourceId: serviceId, resourceName: serviceConfig?.label || serviceId },
                  metadata: { inventoryCount: allInventory.length, provider: selectedProvider },
                });
                fetchInventory(true);
              }}
              disabled={loading}
              className="simulation-action h-9"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
      </header>

  );
}
