"use client";

import { SetupPage } from "@/modules/ai-observability/setup/SetupPage";
import { FeatureLockedGate } from "@/modules/admin";
import { SettingsAdminGuard } from "@/modules/settings";

export default function AiObservabilitySetupPage() {
  return (
    <FeatureLockedGate feature="ai_observability" featureLabel="AI Observability">
      <SettingsAdminGuard deniedMessage="You must be an administrator to view or configure AI Observability integration settings.">
        <SetupPage />
      </SettingsAdminGuard>
    </FeatureLockedGate>
  );
}
