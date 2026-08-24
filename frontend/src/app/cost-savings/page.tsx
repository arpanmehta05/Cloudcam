"use client";

import { CostSavingsDashboard } from "@/modules/cloud-dashboard";
import { FeatureLockedGate } from "@/modules/admin";

export default function CostSavingsPage() {
  return (
    <FeatureLockedGate feature="cost_explorer" featureLabel="Cost Explorer">
      <CostSavingsDashboard />
    </FeatureLockedGate>
  );
}
