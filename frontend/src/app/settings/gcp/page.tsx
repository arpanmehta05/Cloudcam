"use client";

import { GcpSettingsPanel, SettingsAdminGuard } from "@/modules/settings";

export default function GcpIntegrationPage() {
  return (
    <SettingsAdminGuard deniedMessage="You must be an administrator to view or configure cloud integrations.">
      <GcpSettingsPanel />
    </SettingsAdminGuard>
  );
}
