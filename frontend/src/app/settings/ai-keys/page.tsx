"use client";

import { AiKeysSettingsPanel, SettingsAdminGuard } from "@/modules/settings";

export default function AIKeysPage() {
  return (
    <SettingsAdminGuard deniedMessage="You must be an administrator to view or configure AI integration settings.">
      <AiKeysSettingsPanel />
    </SettingsAdminGuard>
  );
}
