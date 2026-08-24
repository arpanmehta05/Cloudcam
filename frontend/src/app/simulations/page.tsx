"use client";

import { SimulationsDashboard } from "@/modules/simulation";
import { FeatureLockedGate } from "@/modules/admin";

export default function SimulationsPage() {
  return (
    <FeatureLockedGate feature="simulations" featureLabel="Simulations">
      <SimulationsDashboard />
    </FeatureLockedGate>
  );
}
