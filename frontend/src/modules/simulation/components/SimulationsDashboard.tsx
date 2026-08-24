"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Rocket, RefreshCw, Search, ArrowLeft, Server } from "@/icons";
import { authFetch, buildApiUrl, getAuthToken } from "@/lib/auth-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logSimulationAction } from "@/lib/simulation-action-log";
import { useRegion } from "@/context/RegionContext";
import { SimulationList } from "./Simulations/SimulationList";
import { NewSimulationModal } from "./Simulations/NewSimulationModal";
import { DestroySimulationModal } from "./Simulations/DestroySimulationModal";
import type { PersistentSimulation } from "./Simulations/SimulationCard";

export function SimulationsDashboard() {
  const { selectedProvider } = useRegion();
  const [simulations, setSimulations] = useState<PersistentSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PersistentSimulation | null>(null);
  const [destroyTarget, setDestroyTarget] = useState<PersistentSimulation | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const fetchSimulations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/simulations");
      const data = await res.json();
      if (data.success) {
        setSimulations(data.simulations);
      }
    } catch (err) {
      console.error("Failed to fetch simulations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSimulations();
  }, [fetchSimulations]);

  const handleDownloadPem = async (id: string, name: string) => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const url = buildApiUrl(`/api/simulations/${id}/download-pem?token=${encodeURIComponent(token)}`);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      void logSimulationAction({
        actionId: "simulation-pem-downloaded",
        displayName: `Downloaded PEM key: ${name}`,
        region: simulations.find((sim) => sim._id === id)?.region,
        simulationId: id,
        simulationName: name,
        target: { resourceId: id, resourceName: name },
        metadata: { provider: simulations.find((sim) => sim._id === id)?.provider || "aws" },
      });
    } catch (err) {
      console.error("Failed to download PEM:", err);
    }
  };

  const handleDeleteSimulation = async () => {
    if (!deleteTarget) return;
    try {
      const res = await authFetch(`/api/simulations/${deleteTarget._id}`, { method: "DELETE" });
      if (res.ok) {
        setSimulations(simulations.filter(sim => sim._id !== deleteTarget._id));
        void logSimulationAction({
          actionId: "simulation-history-deleted",
          displayName: `Deleted simulation canvas: ${deleteTarget.name}`,
          status: "completed",
          region: deleteTarget.region,
          simulationId: deleteTarget._id,
          simulationName: deleteTarget.name,
          target: { resourceId: deleteTarget._id, resourceName: deleteTarget.name },
          metadata: { provider: deleteTarget.provider || "aws" },
        });
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error("Failed to delete simulation:", err);
    }
  };

  const hasActiveDeployments = (sim: PersistentSimulation) => {
    const activeDeps = sim.deployments?.filter((d) => d.status === "active") || [];
    return activeDeps.length > 0 || sim.status === "active";
  };

  const providerSimulations = simulations.filter(
    (sim) => (sim.provider || "aws").toLowerCase() === selectedProvider.toLowerCase()
  );

  const filteredSimulations = providerSimulations.filter((sim) =>
    sim.name.toLowerCase().includes(search.toLowerCase()) ||
    sim.region.toLowerCase().includes(search.toLowerCase()) ||
    (sim.provider || "aws").toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = providerSimulations.filter(hasActiveDeployments).length;
  const failedCount = providerSimulations.filter((sim) => sim.status === "failed").length;
  const deploymentCount = providerSimulations.reduce((count, sim) => count + (sim.deployments?.length || 0), 0);
  const regions = new Set(providerSimulations.map((sim) => sim.region).filter(Boolean)).size;

  return (
    <div className="simulation-surface">
      <header className="simulation-topbar relative z-10 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to dashboard
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Simulation History
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review saved canvases, recover deployment keys, inspect live infrastructure, and clean up active cloud deployments from one workspace.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search simulations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 border-border/80 bg-card/90 pl-9 font-semibold shadow-sm"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                void logSimulationAction({
                  actionId: "simulation-history-refreshed",
                  displayName: "Refreshed simulation history",
                  status: "completed",
                  metadata: { currentCount: simulations.length },
                });
                fetchSimulations();
              }}
              disabled={loading}
              className="simulation-action h-10"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button asChild variant="secondary" className="simulation-action h-10">
              <Link
                href="/simulations/live-canvas"
                onClick={() => void logSimulationAction({
                  actionId: "simulation-live-overview-opened",
                  displayName: "Opened live infrastructure overview",
                  status: "created",
                })}
              >
                <Server className="mr-2 h-4 w-4" />
                Live Infrastructure
              </Link>
            </Button>
            <Button onClick={() => setIsNewModalOpen(true)} className="simulation-action simulation-action-primary h-10">
              <Rocket className="mr-2 h-4 w-4" />
              New Simulation
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 space-y-5 p-4 sm:p-6">
        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["Saved canvases", providerSimulations.length],
            ["Active stacks", activeCount],
            ["Deployments", deploymentCount],
            ["Regions", regions],
          ].map(([label, value]) => (
            <div key={label} className="simulation-stat">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-extrabold text-foreground">{value}</p>
            </div>
          ))}
        </section>

        {failedCount > 0 && (
          <div className="simulation-card-subtle rounded-lg px-4 py-3 text-sm font-semibold text-muted-foreground">
            {failedCount} simulation{failedCount === 1 ? "" : "s"} need attention after failed deployment attempts.
          </div>
        )}

        <SimulationList
          filteredSimulations={filteredSimulations}
          providerSimulations={providerSimulations}
          destroyingId={null}
          onDeleteClick={setDeleteTarget}
          onTerminateClick={setDestroyTarget}
          onDownloadPem={handleDownloadPem}
          hasActiveDeployments={hasActiveDeployments}
          selectedProvider={selectedProvider}
          search={search}
          loading={loading}
        />
      </main>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="border-border/80 bg-card/98 backdrop-blur-xl shadow-2xl rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Delete simulation?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This removes the saved canvas from history. It does not terminate any cloud resources.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-semibold font-mono select-text">
            {deleteTarget?.name}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl border-border/80 text-foreground" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl font-bold" onClick={handleDeleteSimulation}>Delete Canvas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DestroySimulationModal
        isOpen={!!destroyTarget}
        onClose={() => setDestroyTarget(null)}
        destroyTarget={destroyTarget}
        onSuccess={fetchSimulations}
      />

      <NewSimulationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        defaultProvider={selectedProvider}
      />
    </div>
  );
}
