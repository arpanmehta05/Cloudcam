"use client";

import { AwsSettingsPanel, SettingsAdminGuard } from "@/modules/settings";

export default function AWSIntegrationPage() {
  return (
    <SettingsAdminGuard deniedMessage="You must be an administrator to view or configure cloud integrations.">
      <AwsSettingsPanel />
    </SettingsAdminGuard>
  );
}
