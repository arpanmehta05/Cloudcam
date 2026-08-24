"use client";

import PricingSettingsPage from "@/modules/ai-observability/pricing/PricingSettingsPage";
import { FeatureLockedGate } from "@/modules/admin";
import { SettingsAdminGuard } from "@/modules/settings";

export default function PricingPage() {
  return (
    <FeatureLockedGate feature="ai_observability" featureLabel="AI Observability">
      <SettingsAdminGuard deniedMessage="You must be an administrator to configure AI Observability pricing.">
        <PricingSettingsPage />
      </SettingsAdminGuard>
    </FeatureLockedGate>
  );
}
