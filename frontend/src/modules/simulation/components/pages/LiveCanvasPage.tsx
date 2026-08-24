"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { ArrowLeft, RefreshCw, Server, Activity } from "@/icons";
import Link from "next/link";
import { useRegion } from "@/context/RegionContext";
import { serviceRegistry, SERVICE_COLORS } from "@/modules/simulation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useRouter } from "next/navigation";
import * as Icons from "@/icons";
import { logSimulationAction } from "@/lib/simulation-action-log";
import { CustomDropdown } from "@/components/ui/CustomDropdown";

export default function LiveInfrastructureOverview() {
  const router = useRouter();
  const { selectedProvider, selectedRegion: region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("all");

  const dropdownOptions = useMemo(() => {
    const services = serviceRegistry.filter(
      (service) =>
        service.provider === selectedProvider &&
        service.id !== "github" &&
        service.id !== "dockerhub"
    );
    return [
      { value: "all", label: "All Services", description: "Show all discovered services" },
      ...services.map((s) => ({
        value: s.id,
        label: s.label,
        description: s.description,
        badge: `${inventoryCounts[s.id] || 0} resources`,
      })),
    ];
  }, [selectedProvider, inventoryCounts]);

  const filteredServices = useMemo(() => {
    const services = serviceRegistry.filter(
      (service) =>
        service.provider === selectedProvider &&
        service.id !== "github" &&
        service.id !== "dockerhub"
    );
    if (!selectedServiceId || selectedServiceId === "all") {
      return services;
    }
    return services.filter((s) => s.id === selectedServiceId);
  }, [selectedProvider, selectedServiceId]);

  const fetchInventory = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/${selectedProvider}/resources?region=${region}${forceRefresh === true ? '&forceRefresh=true' : ''}`, {
        cache: "no-store",
        headers: forceRefresh ? { "x-rabbittwatch-cache-bypass": "true" } : undefined,
      });
      const data = await res.json();

      if (data.success && data.inventory) {
        const counts: Record<string, number> = {};
        const inventoryKeyForService = (serviceId: string) => {
          if (selectedProvider === "azure") {
            const map: Record<string, string> = {
              azure_vm: "ec2",
              azure_storage: "s3",
              azure_sql: "rds",
              azure_function: "lambda",
              azure_vnet: "efs",
              azure_aks: "eks",
            };
            return map[serviceId] || serviceId;
          }
          if (selectedProvider === "gcp") {
            const map: Record<string, string> = {
              gcp_compute: "ec2",
              gcp_storage: "s3",
              gcp_sql: "rds",
              gcp_function: "lambda",
              gcp_gke: "eks",
            };
            return map[serviceId] || serviceId;
          }
          return serviceId;
        };
        const servicesToMap = serviceRegistry.filter((service) => service.provider === selectedProvider && service.id !== "github" && service.id !== "dockerhub").map((service) => service.id);
        
        servicesToMap.forEach((svcKey) => {
          const inventoryKey = inventoryKeyForService(svcKey);
          counts[svcKey] = Array.isArray(data.inventory[inventoryKey]) ? data.inventory[inventoryKey].length : 0;
        });

        setInventoryCounts(counts);
        setError(null);
        
        if (data.timestamp) {
           setLastUpdated(new Date(data.timestamp).toLocaleTimeString());
        }
      } else {
        setError(data.error || `Failed to fetch live ${selectedProvider.toUpperCase()} resources.`);
        setInventoryCounts({});
      }
    } catch (err: any) {
      console.error("Failed to fetch live inventory:", err);
      setError(err?.message || "An unexpected error occurred while fetching inventory.");
      setInventoryCounts({});
    } finally {
      setLoading(false);
    }
  }, [region, selectedProvider]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const totalResources = Object.values(inventoryCounts).reduce((sum, count) => sum + count, 0);
  const activeServices = Object.values(inventoryCounts).filter((count) => count > 0).length;

  return (
    <div className="flex flex-col">
      <header className="relative z-10 px-4 py-5 sm:px-6 border-b border-border/50">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/simulations"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to simulations
            </Link>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-foreground">
              <Activity className="h-7 w-7 text-primary" />
              Live Infrastructure Overview
              <Badge variant="outline" className="ml-2 border-primary/20 bg-primary/10 text-primary">
                {selectedProvider.toUpperCase()} / {region}
              </Badge>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Select a service to view its resources on an interactive canvas. {lastUpdated && `Last synced at ${lastUpdated}.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <div className="simulation-stat min-w-32">
               <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Resources</p>
               <p className="text-2xl font-extrabold text-foreground">{totalResources}</p>
             </div>
             <div className="simulation-stat min-w-32">
               <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Services</p>
               <p className="text-2xl font-extrabold text-foreground">{activeServices}</p>
             </div>
             <Button
              variant="outline"
              onClick={() => {
                void logSimulationAction({
                  actionId: "live-infrastructure-synced",
                  displayName: "Synced live infrastructure overview",
                  status: "completed",
                  region,
                  metadata: { provider: selectedProvider, totalResources, activeServices },
                });
                fetchInventory(true);
              }}
              disabled={loading}
              className="simulation-action h-10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-4 sm:p-6">
        {/* Custom Search / Dropdown Filter */}
        <div className="mb-6 max-w-sm">
          <CustomDropdown
            options={dropdownOptions}
            value={selectedServiceId}
            onChange={setSelectedServiceId}
            placeholder="Search and filter services..."
            searchPlaceholder="Search services..."
            searchable={true}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500 flex items-center gap-2">
            <Icons.AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold text-xs uppercase tracking-wider">Connection Warning</p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}
        {loading && Object.keys(inventoryCounts).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <RefreshCw className="mb-4 h-12 w-12 animate-spin text-primary" />
            <h3 className="text-lg font-bold text-foreground">Discovering resources...</h3>
            <p className="text-sm text-muted-foreground">Fetching live state from {selectedProvider.toUpperCase()}.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredServices.map((service) => {
              const count = inventoryCounts[service.id] || 0;
              const style = SERVICE_COLORS[service.colorKey];
              const IconComp = (Icons as any)[service.icon] || Server;

              return (
                <Card 
                  key={service.id}
                  onClick={() => {
                    void logSimulationAction({
                      actionId: "live-service-canvas-opened",
                      displayName: `Opened live ${service.label} canvas`,
                      status: "simulated",
                      region,
                      target: { resourceId: service.id, resourceName: service.label },
                      metadata: { resourceCount: count, provider: selectedProvider },
                    });
                    router.push(`/simulations/live-canvas/${service.id}`);
                  }}
                  className={`simulation-card group cursor-pointer overflow-hidden rounded-lg transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 ${count > 0 ? "opacity-100" : "opacity-65 grayscale-[35%] hover:grayscale-0"}`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`rounded-lg border border-border/70 p-3 ${style.bg}`}>
                         <IconComp className={`h-6 w-6 ${style.icon}`} />
                      </div>
                      <Badge variant={count > 0 ? "default" : "outline"} className={count > 0 ? "bg-primary text-primary-foreground" : ""}>
                        {count} Resources
                      </Badge>
                    </div>
                    <h3 className="text-lg font-extrabold text-foreground transition-colors group-hover:text-primary">
                      {service.label}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {service.description}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
