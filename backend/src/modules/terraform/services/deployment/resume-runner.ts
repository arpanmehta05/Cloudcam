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

export async function resumeDeployment(
  deploymentId: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  region: string,
  options: any = {}
): Promise<void> {
  const session = await getSession(deploymentId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "awaiting_image_upload" && session.status !== "running") {
    throw new Error("Session is not in awaiting_image_upload or running state");
  }

  const deploymentRegion = region || session.region || "us-east-1";

  // 1. Find the registry nodes that we need to verify
  const registryServiceIds = ["ecr", "azure_acr", "gcp_artifact_registry"];
  const newRegistryNodes = session.nodes.filter(
    (n: any) => registryServiceIds.includes(n.serviceId) && n.config?.repositoryMode === "new"
  );

  // 2. Verify all new registry nodes have their image uploaded
  for (const registryNode of newRegistryNodes) {
    const repoName = registryNode.config?.repositoryName || registryNode.config?.registryName || registryNode.config?.repositoryId || "sim-repo";
    const tag = registryNode.config?.imageTag || "latest";

    console.log(`[deployment] Verifying image ${repoName}:${tag} in region ${deploymentRegion}...`);
    const exists = await verifyEcrImageExists(
      deploymentRegion,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      repoName,
      tag,
      {
        provider: options.provider,
        azure: options.azure,
        gcp: options.gcp,
        nodeId: registryNode.id,
      }
    );

    const registryLabel = registryNode.serviceId === "azure_acr" ? "Azure Container Registry" : registryNode.serviceId === "gcp_artifact_registry" ? "Artifact Registry" : "ECR repository";
    if (!exists) {
      throw new Error(`Image '${tag}' was not found in ${registryLabel} '${repoName}'. Please build and push it before resuming.`);
    }
  }

  // 3. Find the previous state from PersistentSimulationModel
  const persistentSim = await PersistentSimulationModel.findOne({
    userId: session.userId,
    "deployments.deploymentId": deploymentId
  });
  if (!persistentSim) throw new Error("Persistent simulation record not found");

  const deploymentRecord = persistentSim.deployments?.find(d => d.deploymentId === deploymentId);
  const previousState = deploymentRecord?.state;
  if (!previousState) throw new Error("Previous Terraform state not found");

  // 4. Generate the full HCL for Stage 2
  let githubToken: string | undefined;
  if (session.userId) {
    try {
      const user = await User.findById(session.userId);
      if (user?.githubCredentials?.accessToken) {
        githubToken = decryptKey(user.githubCredentials.accessToken);
      }
    } catch (err) {
      console.error("[resumeDeployment] Failed to retrieve or decrypt GitHub token:", err);
    }
  }

  const tfReq: TfRequest = {
    nodes: session.nodes,
    edges: session.edges,
    region: deploymentRegion,
    name: session.name,
    deploymentId,
    provider: options.provider,
    isVmContributor: options.isVmContributor,
    existingVnetName: options.existingVnetName,
    existingSubnetName: options.existingSubnetName,
    githubToken,
  };
  const result = generateTerraformJson(tfReq);
  const hcl = result.terraformHcl;

  // 5. Update session status and start the container with the full HCL and previous state
  await updateSession(deploymentId, { status: "running", region: deploymentRegion });
  appendDeploymentLog(deploymentId, "[runtime] Image verification succeeded. Resuming Stage 2 deployment...", "stdout");

  let container: any = null;
  try {
    container = await createAndStartContainer(
      deploymentId,
      hcl,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      deploymentRegion,
      {
        ...options,
        state: previousState,
      }
    );

    await updateSession(deploymentId, { containerId: container.containerId });

    // Wait for container to settle and verify it didn't crash instantly
    await new Promise(resolve => setTimeout(resolve, 3000));
    const initialStatus = await getContainerStatus(container.containerId);
    if (isTerminalContainerStatus(initialStatus)) {
      const exitCode = await getContainerExitCode(container.containerId);
      const crashLogs = await getContainerLogs(container.containerId);
      const lastLine = crashLogs.length > 0 ? crashLogs[crashLogs.length - 1] : "No logs produced";
      throw new Error(`Execution environment crashed on startup: ${lastLine}`);
    }

    const stopStreaming = streamLogs(
      container.containerId,
      (line, source) => {
        appendDeploymentLog(deploymentId, line, source);
        if (
          line.includes("---END-OUTPUTS---") ||
          line.includes("[runtime] Uploaded Terraform outputs") ||
          line.includes("[step] capturing outputs")
        ) {
          void hydrateDeploymentOutputsEarly(
            container.containerId,
            deploymentId,
            options.provider,
            session.nodes
          );
        }
      },
      () => {
        console.log(`[deployment] Log stream closed for resumed ${deploymentId}`);
      },
      (err) => console.error(`[deployment] Resumed stream error for ${deploymentId}:`, err)
    );

    // Monitoring loop for Stage 2
    let checks = 0;
    let isChecking = false;
    const checkExit = setInterval(async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        checks++;
        const sessionState = await getSession(deploymentId);
        if (!sessionState || ["complete", "failed", "cancelled", "timed_out"].includes(sessionState.status)) {
          clearInterval(checkExit);
          return;
        }

        const status = await getContainerStatus(container.containerId);

        if (isTerminalContainerStatus(status)) {
          clearInterval(checkExit);
          setTimeout(async () => {
            stopStreaming();
            try {
              const exitCode = await getContainerExitCode(container.containerId);
              const finalLogs = await getContainerLogs(container.containerId);
              for (const line of finalLogs) {
                appendDeploymentLog(deploymentId, line, "stdout");
              }

              if (exitCode === 0) {
                const hasVm = session.nodes.some((node: any) => node.serviceId === "ec2" || node.serviceId === "azure_vm" || node.serviceId === "gcp_compute");
                const { state, outputs } = await captureTerraformArtifactsWithRetry(
                  container.containerId,
                  deploymentId,
                  options.provider,
                  hasVm
                );

                if (!state || (hasVm && !outputs.private_key?.value)) {
                  await updateSession(deploymentId, {
                    status: "failed",
                    errorMessage: "Terraform completed, but Rabbittize could not capture state or outputs.",
                  });
                  return;
                }

                // Finalize Stage 2
                try {
                  await verifyDeployedResources(deploymentId, options.provider, session.nodes, outputs, {
                    ...options,
                    region: deploymentRegion
                  });
                } catch (err: any) {
                  console.error(`[deployment] verifyResumedDeployedResources failed:`, err);
                }

                const finalOutputs: any = {
                  instance_ips: outputs.instance_ips?.value || [],
                };
                if (outputs.private_key?.value) {
                  finalOutputs.private_key = encrypt(outputs.private_key.value);
                }
                if (outputs.key_name?.value) {
                  finalOutputs.key_name = outputs.key_name.value;
                }
                for (const key of Object.keys(outputs)) {
                  if (key.startsWith("vm_info_") || key.startsWith("ecr_url_") || key.startsWith("apigateway_url_") || key.startsWith("lb_info_")) {
                    finalOutputs[key] = outputs[key];
                  }
                }

                await PersistentSimulationModel.updateOne(
                  { _id: persistentSim._id, "deployments.deploymentId": deploymentId },
                  {
                    $set: {
                      status: "active",
                      "terraform.state": state,
                      "terraform.outputs": finalOutputs,
                      "deployments.$.status": "active",
                      "deployments.$.state": state,
                      "deployments.$.outputs": finalOutputs,
                    }
                  }
                );

                await updateSession(deploymentId, {
                  status: "complete",
                  outputs,
                  completedAt: new Date(),
                });
                appendDeploymentLog(deploymentId, "[runtime] Deployment completed successfully!", "stdout");

              } else {
                await updateSession(deploymentId, {
                  status: "failed",
                  errorMessage: "Terraform execution failed in Stage 2",
                  completedAt: new Date(),
                });
              }
            } catch (err: any) {
              console.error("[deployment] Resume finalize error:", err);
              await updateSession(deploymentId, {
                status: "failed",
                errorMessage: err.message,
                completedAt: new Date(),
              });
            }
          }, 2000);
        }
      } catch (err) {
        console.error("[deployment] Resume check status error:", err);
      } finally {
        isChecking = false;
      }
    }, 4000);

  } catch (err: any) {
    console.error("[deployment] Resume execute error:", err);
    await updateSession(deploymentId, {
      status: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    });
  }
}

