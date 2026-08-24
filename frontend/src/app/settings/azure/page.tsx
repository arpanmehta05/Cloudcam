"use client";

import { AzureSettingsPanel, SettingsAdminGuard } from "@/modules/settings";

export default function AzureIntegrationPage() {
  return (
    <SettingsAdminGuard deniedMessage="You must be an administrator to view or configure cloud integrations.">
      <AzureSettingsPanel />
    </SettingsAdminGuard>
  );
}
