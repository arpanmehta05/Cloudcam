"use client";

import { ReportsSettingsPanel, SettingsAdminGuard } from "@/modules/settings";

export default function UsageReportsPage() {
  return (
    <SettingsAdminGuard deniedMessage="You must be an administrator to view or configure report settings.">
      <ReportsSettingsPanel />
    </SettingsAdminGuard>
  );
}
