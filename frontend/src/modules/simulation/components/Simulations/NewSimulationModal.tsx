"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth-fetch";
import { Rocket, Loader2 } from "@/icons";
import { logSimulationAction } from "@/lib/simulation-action-log";

interface NewSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProvider?: string;
}

const REGION_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  aws: [
    { value: "us-east-1", label: "us-east-1 (N. Virginia)" },
    { value: "us-west-2", label: "us-west-2 (Oregon)" },
    { value: "eu-west-1", label: "eu-west-1 (Ireland)" },
    { value: "ap-southeast-1", label: "ap-southeast-1 (Singapore)" },
  ],
  azure: [
    { value: "eastus", label: "eastus (East US)" },
    { value: "westus2", label: "westus2 (West US 2)" },
    { value: "northeurope", label: "northeurope (North Europe)" },
    { value: "southeastasia", label: "southeastasia (Southeast Asia)" },
  ],
  gcp: [
    { value: "us-central1", label: "us-central1 (Iowa)" },
    { value: "us-east1", label: "us-east1 (S. Carolina)" },
    { value: "europe-west1", label: "europe-west1 (Belgium)" },
    { value: "asia-east1", label: "asia-east1 (Taiwan)" },
  ],
};

export function NewSimulationModal({
  isOpen,
  onClose,
  defaultProvider = "aws",
}: NewSimulationModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<"aws" | "azure" | "gcp">("aws");
  const [region, setRegion] = useState("us-east-1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when defaultProvider changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const p = (defaultProvider?.toLowerCase() || "aws") as "aws" | "azure" | "gcp";
      setProvider(p);
      setName(`New ${p.toUpperCase()} Simulation`);
      const options = REGION_OPTIONS[p] || [];
      if (options.length > 0) {
        setRegion(options[0].value);
      }
      setError(null);
    }
  }, [isOpen, defaultProvider]);

  // Adjust region when provider changes
  const handleProviderChange = (newProvider: "aws" | "azure" | "gcp") => {
    setProvider(newProvider);
    setName(`New ${newProvider.toUpperCase()} Simulation`);
    const options = REGION_OPTIONS[newProvider] || [];
    if (options.length > 0) {
      setRegion(options[0].value);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please enter a name for the simulation.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/simulations", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          provider,
          region,
          nodes: [],
          edges: [],
        }),
      });
      const data = await res.json();
      if (data.success && data.simulation) {
        void logSimulationAction({
          actionId: "simulation-new-started",
          displayName: `Created simulation canvas: ${name}`,
          status: "completed",
          region,
          simulationId: data.simulation._id,
          simulationName: name,
          target: { resourceId: data.simulation._id, resourceName: name },
          metadata: { provider },
        });
        onClose();
        router.push(`/simulation?id=${data.simulation._id}`);
      } else {
        setError(data.error || "Failed to create simulation");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create simulation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="sm:max-w-md border-border/80 bg-card/98 backdrop-blur-xl shadow-2xl rounded-2xl">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">Create New Simulation</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set up a new virtual cloud architecture design canvas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Simulation Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Cluster"
              disabled={loading}
              className="h-10 bg-background/80 border-border/80 focus:border-primary/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
              Cloud Provider
            </label>
            <div className="flex rounded-lg bg-muted p-1 gap-1">
              {(["aws", "azure", "gcp"] as const).map((p) => {
                const active = p === provider;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={loading}
                    onClick={() => handleProviderChange(p)}
                    className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                      active
                        ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
              Target Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={loading}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
            >
              {(REGION_OPTIONS[provider] || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs font-semibold text-red-500">
              {error}
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-border/50 pt-3.5 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border-border/80 hover:bg-muted/80 text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading}
            className="rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/95 active:scale-[0.98] transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Start Canvas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
