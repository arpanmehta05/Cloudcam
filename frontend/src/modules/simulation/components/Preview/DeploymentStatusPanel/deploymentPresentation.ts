export type DeploymentPhase =
  | "creds"
  | "validating"
  | "validated"
  | "starting"
  | "running"
  | "awaiting_image_upload"
  | "complete"
  | "failed";

export function maskDeploymentId(id: string | null | undefined) {
  if (!id || typeof id !== "string") return "Unknown";
  return id.replace(/(.{4})(.+)(.{4})/, "$1****$3");
}

function getStepIndex(phase: DeploymentPhase) {
  if (phase === "creds" || phase === "validating") return 0;
  if (phase === "validated" || phase === "starting") return 1;
  if (phase === "running" || phase === "awaiting_image_upload") return 2;
  return 3;
}

export function buildDeploymentPresentation({
  phase,
  mode,
  action,
  provider,
  registryLabel,
}: {
  phase: DeploymentPhase;
  mode: "simulation" | "live-action";
  action: string;
  provider: "aws" | "azure" | "gcp";
  registryLabel: string;
}) {
  const providerLabel =
    provider === "azure" ? "Azure" : provider === "gcp" ? "GCP" : "AWS";
  const steps = [
    { label: "Auth", desc: "Credentials" },
    { label: "Verify", desc: "Configuration" },
    {
      label: "Deploy",
      desc: mode === "live-action" ? "Running action" : "Running HCL",
    },
    { label: "Outcome", desc: "Status" },
  ];
  const phaseLabel: Record<DeploymentPhase, string> = {
    creds:
      mode === "live-action"
        ? `Enter Credentials to ${action}`
        : `Enter ${providerLabel} Credentials`,
    validating: "Validating credentials...",
    validated: "Credentials Verified",
    starting:
      mode === "live-action"
        ? "Preparing action..."
        : "Preparing deployment...",
    running:
      mode === "live-action"
        ? `Executing ${action} on ${providerLabel}`
        : `Deploying to ${providerLabel}`,
    awaiting_image_upload: `Awaiting ${registryLabel} Image Upload`,
    complete:
      mode === "live-action" ? "Action Complete" : "Deployment Complete",
    failed: mode === "live-action" ? "Action Failed" : "Deployment Failed",
  };

  return {
    activeStep: getStepIndex(phase),
    phaseLabel,
    providerLabel,
    steps,
  };
}
