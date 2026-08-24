"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, RefreshCw } from "@/icons";
import { SimulationCard, type PersistentSimulation } from "./SimulationCard";

interface SimulationListProps {
  filteredSimulations: PersistentSimulation[];
  providerSimulations: PersistentSimulation[];
  destroyingId: string | null;
  onDeleteClick: (sim: PersistentSimulation) => void;
  onTerminateClick: (sim: PersistentSimulation) => void;
  onDownloadPem: (id: string, name: string) => void;
  hasActiveDeployments: (sim: PersistentSimulation) => boolean;
  selectedProvider: string;
  search: string;
  loading: boolean;
}

export function SimulationList({
  filteredSimulations,
  providerSimulations,
  destroyingId,
  onDeleteClick,
  onTerminateClick,
  onDownloadPem,
  hasActiveDeployments,
  selectedProvider,
  search,
  loading,
}: SimulationListProps) {
  if (loading && providerSimulations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <RefreshCw className="mb-4 h-12 w-12 animate-spin text-primary" />
        <h3 className="text-lg font-bold text-foreground">Loading simulations...</h3>
        <p className="text-sm text-muted-foreground">This will only take a moment.</p>
      </div>
    );
  }

  if (filteredSimulations.length === 0) {
    return (
      <Card className="simulation-card flex flex-col items-center justify-center rounded-lg border-dashed py-24 text-center">
        <Server className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-bold text-foreground">No simulations found</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {search ? `No results for "${search}"` : `You haven't run any ${selectedProvider.toUpperCase()} simulations yet. Start your first one today!`}
        </p>
        {!search && (
          <Button asChild className="simulation-action simulation-action-primary mt-6">
            <Link href="/simulation">Start First Simulation</Link>
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filteredSimulations.map((sim) => (
        <SimulationCard
          key={sim._id}
          sim={sim}
          destroyingId={destroyingId}
          onDeleteClick={onDeleteClick}
          onTerminateClick={onTerminateClick}
          onDownloadPem={onDownloadPem}
          hasActiveDeployments={hasActiveDeployments}
        />
      ))}
    </div>
  );
}
