"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Download, Trash2, Flame, CheckCircle, XCircle, AlertCircle } from "@/icons";
import { logSimulationAction } from "@/lib/simulation-action-log";

export interface PersistentSimulation {
  _id: string;
  name: string;
  status: "active" | "destroyed" | "failed";
  provider?: "aws" | "azure" | "gcp";
  region: string;
  hasPrivateKey?: boolean;
  deployments?: Array<{
    deploymentId: string;
    label: string;
    status: "active" | "destroyed" | "failed";
    provider?: "aws" | "azure" | "gcp";
    region: string;
    createdAt: string;
    destroyedAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface SimulationCardProps {
  sim: PersistentSimulation;
  destroyingId: string | null;
  onDeleteClick: (sim: PersistentSimulation) => void;
  onTerminateClick: (sim: PersistentSimulation) => void;
  onDownloadPem: (id: string, name: string) => void;
  hasActiveDeployments: (sim: PersistentSimulation) => boolean;
}

export function SimulationCard({
  sim,
  destroyingId,
  onDeleteClick,
  onTerminateClick,
  onDownloadPem,
  hasActiveDeployments,
}: SimulationCardProps) {
  const router = useRouter();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "destroyed":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20">
            Active
          </Badge>
        );
      case "destroyed":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Destroyed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/5 text-red-500 border-red-500/20">
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProviderBadge = (provider?: string) => {
    const p = (provider || "aws").toLowerCase();
    switch (p) {
      case "azure":
        return (
          <Badge variant="outline" className="bg-sky-500/5 text-sky-500 border-sky-500/20 uppercase text-[9px] font-bold tracking-wider">
            Azure
          </Badge>
        );
      case "gcp":
        return (
          <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20 uppercase text-[9px] font-bold tracking-wider">
            GCP
          </Badge>
        );
      case "aws":
      default:
        return (
          <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 uppercase text-[9px] font-bold tracking-wider">
            AWS
          </Badge>
        );
    }
  };

  const handleCardClick = () => {
    void logSimulationAction({
      actionId: "simulation-history-opened",
      displayName: `Opened simulation: ${sim.name}`,
      status: "created",
      region: sim.region,
      simulationId: sim._id,
      simulationName: sim.name,
      target: { resourceId: sim._id, resourceName: sim.name },
    });
    router.push(`/simulation?id=${sim._id}`);
  };

  return (
    <Card 
      onClick={handleCardClick}
      className="simulation-card group cursor-pointer overflow-hidden rounded-lg transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-foreground transition-colors group-hover:text-primary">
              {sim.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(sim.createdAt).toLocaleDateString()}
              </span>
              {getProviderBadge(sim.provider)}
              <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {sim.region}
              </span>
            </div>
          </div>
          {getStatusIcon(sim.status)}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="simulation-card-subtle rounded-md p-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Deployment Count</p>
            <p className="text-sm font-extrabold text-foreground">{sim.deployments?.length || 0}</p>
          </div>
          <div className="simulation-card-subtle rounded-md p-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Updated</p>
            <p className="truncate text-sm font-extrabold text-foreground font-semibold">{new Date(sim.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            {getStatusBadge(sim.status)}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
              onClick={(e) => {
                e.stopPropagation();
                void logSimulationAction({
                  actionId: "simulation-delete-confirmation-opened",
                  displayName: `Opened delete confirmation: ${sim.name}`,
                  status: "created",
                  region: sim.region,
                  simulationId: sim._id,
                  simulationName: sim.name,
                  target: { resourceId: sim._id, resourceName: sim.name },
                });
                onDeleteClick(sim);
              }}
              title="Delete Simulation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {hasActiveDeployments(sim) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-500/10"
                disabled={destroyingId === sim._id}
                onClick={(e) => { e.stopPropagation(); onTerminateClick(sim); }}
                title="Terminate cloud resources"
              >
                <Flame className={`h-4 w-4 ${destroyingId === sim._id ? "animate-pulse" : ""}`} />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-500/10 disabled:opacity-30 disabled:pointer-events-none"
              disabled={!sim.hasPrivateKey}
              onClick={(e) => { e.stopPropagation(); onDownloadPem(sim._id, sim.name); }}
              title={sim.hasPrivateKey ? "Download PEM Key" : "No PEM key available"}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
