"use client";

import { DeploymentStatusPanel } from "@/modules/simulation";

interface LiveActionDeploymentPanelProps {
  deploymentId: string;
  action: string;
  resourceLabel: string;
  service?: string;
  resourceId?: string;
  region: string;
  onClose: () => void;
  provider?: "aws" | "azure" | "gcp";
}

export function LiveActionDeploymentPanel({
  deploymentId,
  action,
  resourceLabel,
  service,
  resourceId,
  region,
  onClose,
  provider = "aws",
}: LiveActionDeploymentPanelProps) {
  return (
    <DeploymentStatusPanel
      mode="live-action"
      deploymentId={deploymentId}
      action={action}
      resourceLabel={resourceLabel}
      service={service}
      resourceId={resourceId}
      region={region}
      onClose={onClose}
      provider={provider}
    />
  );
}
