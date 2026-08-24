"use client";

import { SimulationOrchestrator } from "@/modules/simulation";
import { FeatureLockedGate } from "@/modules/admin";

export default function SimulationPage() {
  return (
    <FeatureLockedGate feature="simulations" featureLabel="Simulations">
      <SimulationOrchestrator />
    </FeatureLockedGate>
  );
}
