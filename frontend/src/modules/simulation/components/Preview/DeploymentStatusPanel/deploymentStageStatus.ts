import type { DeploymentPhase } from "./deploymentPresentation";

export function buildDeploymentStageStatuses(
  phase: DeploymentPhase,
  hasPausedForUpload: boolean,
) {
  const stage1Status =
    phase === "running" && !hasPausedForUpload
      ? "active"
      : phase === "awaiting_image_upload" || hasPausedForUpload || phase === "complete"
        ? "completed"
        : "pending";

  const stage2Status =
    phase === "awaiting_image_upload"
      ? "active"
      : hasPausedForUpload && (phase === "running" || phase === "complete")
        ? "completed"
        : "pending";

  const stage3Status =
    phase === "running" && hasPausedForUpload
      ? "active"
      : phase === "complete"
        ? "completed"
        : "pending";

  return { stage1Status, stage2Status, stage3Status };
}

export function isStage2StartLine(line: string) {
  return (
    line.includes("Resuming Stage 2 deployment...") ||
    line.includes("Image verification succeeded")
  );
}
