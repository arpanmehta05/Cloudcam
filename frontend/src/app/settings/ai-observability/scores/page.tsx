"use client";

import ScoresPage from "@/modules/ai-observability/scores/ScoresPage";
import { FeatureLockedGate } from "@/modules/admin";
import { SettingsAdminGuard } from "@/modules/settings";

export default function ScoreSettingsPage() {
  return (
    <FeatureLockedGate feature="ai_observability" featureLabel="AI Observability">
      <SettingsAdminGuard deniedMessage="You must be an administrator to configure AI Observability scores.">
        <ScoresPage />
      </SettingsAdminGuard>
    </FeatureLockedGate>
  );
}
