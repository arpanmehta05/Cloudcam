"use client";

import React from "react";
import { LogViewerPanel, useVpsLogs } from "@/modules/vps-logs";
import { FeatureLockedGate } from "@/modules/admin";

function VpsLogsContent() {
  const state = useVpsLogs();
  return <LogViewerPanel state={state} />;
}

export default function VpsLogsPage() {
  return (
    <FeatureLockedGate feature="vps_logs" featureLabel="VPS Logs">
      <VpsLogsContent />
    </FeatureLockedGate>
  );
}
