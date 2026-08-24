import {
  createAndStartContainer,
  streamLogs,
  stopContainer,
  getContainerStatus,
  getContainerExitCode,
  getContainerLogs,
  removeContainer,
  getState,
  isTerminalContainerStatus,
  isDockerAvailable,
  ensureImage,
  buildImage,
} from "../../../../services/container-manager";
import {
  getSession,
  updateSession,
  appendDeploymentLog,
} from "./store";
import { PersistentSimulationModel } from "../../../../models/simulation-persistent.model";
import { User, decryptKey } from "../../../../models/user.model";
import { encrypt } from "../../../../utils/encryption";
import { randomUUID } from "crypto";
import path from "path";
import {
  earlyOutputCaptures,
  captureTerraformArtifactsWithRetry,
  hydrateDeploymentOutputsEarly,
} from "./pem.service";
import { markPersistentSimulationFailed } from "./state-machine";
import { generateTerraformJson, type TfRequest } from "../generation";
import { verifyEcrImageExists } from "./registry-image-verifier";
import { verifyDeployedResources } from "./resource-verification";
import { DEPLOYMENT_TIMEOUT_MS, TERMINAL_DEPLOYMENT_STATUSES, DOCKER_UNAVAILABLE_MESSAGE, type DestroyProviderOptions, extractErrorMessage } from "./runner-shared";

export async function cancelDeployment(deploymentId: string): Promise<void> {
  const session = await getSession(deploymentId);
  if (!session || !session.containerId) return;

  await stopContainer(session.containerId);
  await removeContainer(session.containerId);
  await updateSession(deploymentId, {
    status: "cancelled",
    errorMessage: "User cancelled",
    completedAt: new Date()
  });
}

export async function destroyPersistentSimulation(
  userId: string,
  simulationId: string,
  targetDeploymentId: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  region: string,
  progressSessionId?: string,
  providerOptions: DestroyProviderOptions = {}
): Promise<{ destroyed: boolean; logs: string[] }> {
  const sim = await PersistentSimulationModel.findOne({ _id: simulationId, userId });
  if (!sim) throw new Error("Simulation not found");
  const deployments = sim.deployments || [];

  // Gracefully handle corrupt "active" simulations from older builds that have no state or deployments.
  // Instead of throwing an error and leaving them stuck, clean up their status to "destroyed".
  if (deployments.length === 0 && (!sim.terraform?.state || !sim.terraform?.hcl)) {
    await PersistentSimulationModel.findByIdAndUpdate(sim._id, {
      $set: { status: "destroyed" }
    });
    if (progressSessionId) {
      await appendDeploymentLog(progressSessionId, "[destroy] No active cloud state or deployments found. Cleaning up simulation status to destroyed.");
      await updateSession(progressSessionId, {
        status: "complete",
        completedAt: new Date(),
      });
    }
    return { destroyed: true, logs: ["No active cloud state or deployments found. Cleaned up simulation status to destroyed."] };
  }

  const deployment = deployments.find((item: any) => item.deploymentId === targetDeploymentId) || (
    targetDeploymentId === "legacy" && sim.terraform?.hcl && sim.terraform?.state
      ? {
          deploymentId: "legacy",
          label: "Legacy deployment",
          status: sim.status === "destroyed" ? "destroyed" : "active",
          region: sim.region,
          hcl: sim.terraform.hcl,
          state: sim.terraform.state,
        }
      : null
  );
  if (!deployment) throw new Error("Deployment not found for this simulation");
  if (deployment.status === "destroyed") return { destroyed: true, logs: ["Deployment is already marked destroyed."] };
  if (!deployment.hcl || !deployment.state) {
    throw new Error("Terraform HCL and raw state are required before a simulation can be destroyed.");
  }
  if ((deployment.state as any).format_version && !(deployment.state as any).version) {
    throw new Error("This simulation was saved with a display-only state format. Redeploy it once so raw Terraform state is captured, then destroy.");
  }

  const dockerOk = await isDockerAvailable();
  if (!dockerOk) throw new Error(DOCKER_UNAVAILABLE_MESSAGE);

  if (progressSessionId) {
    let displayLabel = deployment.label || targetDeploymentId;
    if (sim.name && displayLabel) {
      displayLabel = displayLabel
        .replace(/^Untitled Simulation/, sim.name)
        .replace(/^Simulation/, sim.name);
    }
    await appendDeploymentLog(progressSessionId, `[destroy] Preparing Terraform destroy for ${displayLabel}`);
  }

  const imageReady = await ensureImage();
  if (!imageReady) {
    const backendDir = path.join(__dirname, "../../");
    await buildImage(backendDir);
  }

  const destroyId = progressSessionId || `destroy-${randomUUID()}`;
  
  let hclToUse = deployment.hcl;
  if (hclToUse && hclToUse.includes("aws_ecr_repository")) {
    hclToUse = hclToUse.replace(
      /(resource\s+"aws_ecr_repository"\s+"[^"]+"\s+\{[\s\S]*?\n\})/g,
      (match) => {
        if (!match.includes("force_delete")) {
          return match.replace(/(\{\s*)/, "$1force_delete = true\n  ");
        }
        return match;
      }
    );
  }

  const container = await createAndStartContainer(
    destroyId,
    hclToUse,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region || deployment.region || sim.region,
    {
      action: "destroy",
      state: deployment.state,
      provider: providerOptions.provider,
      azure: providerOptions.azure,
      gcp: providerOptions.gcp,
    }
  );
  let stopStreaming: (() => void) | null = null;

  if (progressSessionId) {
    await updateSession(progressSessionId, { status: "running", containerId: container.containerId });
    stopStreaming = streamLogs(
      container.containerId,
      (line, source) => appendDeploymentLog(progressSessionId, line, source),
      () => console.log(`[destroy] Log stream closed for ${progressSessionId}`),
      (err) => console.error(`[destroy] Stream error for ${progressSessionId}:`, err)
    );
  }

  try {
    const startedAt = Date.now();
    while (Date.now() - startedAt < DEPLOYMENT_TIMEOUT_MS) {
      const status = await getContainerStatus(container.containerId);
      if (isTerminalContainerStatus(status)) {
        const exitCode = await getContainerExitCode(container.containerId);
        const logs = await getContainerLogs(container.containerId);
        stopStreaming?.();
        if (progressSessionId) {
          for (const line of logs) {
            await appendDeploymentLog(progressSessionId, line, "stdout");
          }
        }
        await removeContainer(container.containerId);

        if (exitCode === 0) {
          if (targetDeploymentId !== "legacy") {
            await PersistentSimulationModel.updateOne(
              { _id: sim._id, "deployments.deploymentId": targetDeploymentId },
              {
                $set: {
                  "deployments.$.status": "destroyed",
                  "deployments.$.state": null,
                  "deployments.$.destroyedAt": new Date(),
                },
                $unset: {
                  "deployments.$.outputs.private_key": "",
                  "deployments.$.outputs.key_name": "",
                },
              }
            );
          }

          const remaining = await PersistentSimulationModel.findById(sim._id).select("deployments").lean();
          const activeDeployments = targetDeploymentId !== "legacy"
            ? (remaining?.deployments || []).filter((item: any) => item.status === "active")
            : [];
          const latestActive = activeDeployments
            .filter((item: any) => item.outputs?.private_key)
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

          const topLevelUpdate: any = {
            $set: {
              status: activeDeployments.length > 0 ? "active" : "destroyed",
            },
            $unset: {},
          };

          if (latestActive?.outputs) {
            topLevelUpdate.$set["terraform.outputs"] = latestActive.outputs;
            topLevelUpdate.$set["terraform.state"] = latestActive.state || null;
          } else {
            topLevelUpdate.$unset["terraform.outputs.private_key"] = "";
            topLevelUpdate.$unset["terraform.outputs.key_name"] = "";
            if (activeDeployments.length === 0 || targetDeploymentId === "legacy") {
              topLevelUpdate.$unset["terraform.state"] = "";
            }
          }

          if (Object.keys(topLevelUpdate.$unset).length === 0) {
            delete topLevelUpdate.$unset;
          }

          await PersistentSimulationModel.findByIdAndUpdate(sim._id, topLevelUpdate);
          if (progressSessionId) {
            await updateSession(progressSessionId, {
              status: "complete",
              completedAt: new Date(),
            });
          }
          return { destroyed: true, logs };
        }

        if (targetDeploymentId !== "legacy") {
          await PersistentSimulationModel.updateOne(
            { _id: sim._id, "deployments.deploymentId": targetDeploymentId },
            { $set: { "deployments.$.status": "failed" } }
          );
        }
        if (progressSessionId) {
          await updateSession(progressSessionId, {
            status: "failed",
            errorMessage: `Terraform destroy failed (exit code ${exitCode}). ${logs.slice(-1)[0] || "Check logs for details."}`,
            completedAt: new Date(),
          });
        }
        throw new Error(`Terraform destroy failed (exit code ${exitCode}). ${logs.slice(-1)[0] || "Check Docker logs for details."}`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (progressSessionId) {
      await updateSession(progressSessionId, {
        status: "timed_out",
        errorMessage: "Terraform destroy exceeded the 30 minute limit.",
        completedAt: new Date(),
      });
    }
    throw new Error("Terraform destroy exceeded the 30 minute limit.");
  } finally {
    stopStreaming?.();
    await stopContainer(container.containerId);
    await removeContainer(container.containerId);
  }
}

