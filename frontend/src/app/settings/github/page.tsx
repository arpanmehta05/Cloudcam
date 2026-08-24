"use client";

import { GithubSettingsPanel, SettingsAdminGuard } from "@/modules/settings";

export default function GithubSettingsPage() {
  return (
    <SettingsAdminGuard deniedMessage="You must be an administrator to view or configure cloud integrations.">
      <GithubSettingsPanel />
    </SettingsAdminGuard>
  );
}
