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

export async function runDeployment(
  deploymentId: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  region: string,
  options: {
    provider?: "aws" | "azure" | "gcp";
    azure?: {
      clientId: string;
      clientSecret: string;
      tenantId: string;
      subscriptionId: string;
    };
    isVmContributor?: boolean;
    existingVnetName?: string;
    existingSubnetName?: string;
    gcp?: {
      projectId: string;
      clientEmail: string;
      privateKey: string;
    };
  } = {}
): Promise<void> {
  const session = await getSession(deploymentId);
  if (!session) throw new Error("Session not found");

  const deploymentRegion = region || session.region || "us-east-1";

  let githubToken: string | undefined;
  if (session.userId) {
    try {
      const user = await User.findById(session.userId);
      if (user?.githubCredentials?.accessToken) {
        githubToken = decryptKey(user.githubCredentials.accessToken);
      }
    } catch (err) {
      console.error("[runDeployment] Failed to retrieve or decrypt GitHub token:", err);
    }
  }

  const registryServiceIds = ["ecr", "azure_acr", "gcp_artifact_registry"];
  const newRegistryNodes = session.nodes.filter(
    (n: any) => registryServiceIds.includes(n.serviceId) && n.config?.repositoryMode === "new"
  );
  const computeServices = [
    "ec2",
    "ecs",
    "eks",
    "azure_vm",
    "azure_function",
    "azure_aks",
    "gcp_compute",
    "gcp_function",
    "gcp_gke",
    "gcp_cloud_run"
  ];
  const hasComputeConnected = session.nodes.some(
    (n: any) => computeServices.includes(n.serviceId) &&
           session.edges.some((e: any) => e.source === n.id || e.target === n.id)
  );
  const requiresTwoStage = newRegistryNodes.length > 0 && hasComputeConnected;

  const fullTfReq: TfRequest = {
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
  const fullResult = generateTerraformJson(fullTfReq);
  const fullHcl = fullResult.terraformHcl;

  let hcl = fullHcl;
  let isStage1 = false;

  if (requiresTwoStage) {
    isStage1 = true;
    const registryLabel = options.provider === "azure" ? "Container Registry" : options.provider === "gcp" ? "Artifact Registry" : "ECR";
    const tfReqStage1: TfRequest = {
      nodes: newRegistryNodes,
      edges: [],
      region: deploymentRegion,
      name: `${session.name} - ${registryLabel}`,
      deploymentId,
      provider: options.provider,
      githubToken,
    };
    const resultStage1 = generateTerraformJson(tfReqStage1);
    hcl = resultStage1.terraformHcl;
  }

  const detectedProvider = options.provider || (
    session.nodes?.[0]?.serviceId?.startsWith("gcp_")
      ? "gcp"
      : session.nodes?.[0]?.serviceId?.startsWith("azure")
        ? "azure"
        : "aws"
  );

  // Update or create persistent simulation record
  let persistentSim: any;
  const simData = {
    userId: session.userId,
    name: session.name || `Simulation ${new Date().toLocaleString()}`,
    status: "active",
    region: deploymentRegion,
    provider: detectedProvider,
    graph: {
      nodes: session.nodes,
      edges: session.edges,
    },
    terraform: {
      hcl: fullHcl,
    },
  };

  if (session.draftId) {
    persistentSim = await PersistentSimulationModel.findByIdAndUpdate(
      session.draftId,
      { $set: simData },
      { returnDocument: "after" }
    );
  }
  
  if (!persistentSim) {
    persistentSim = await PersistentSimulationModel.create(simData);
  }

  await updateSession(deploymentId, { status: "running", region: deploymentRegion });
  console.log(`[deployment] Starting run for ${deploymentId} in ${deploymentRegion} (Persistent ID: ${persistentSim._id})`);

  let container: any = null;
  try {
    container = await createAndStartContainer(
      deploymentId,
      hcl,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      deploymentRegion,
      options
    );

    await updateSession(deploymentId, { containerId: container.containerId });

    // Wait for container to settle and verify it didn't crash instantly
    await new Promise(resolve => setTimeout(resolve, 3000));
    const initialStatus = await getContainerStatus(container.containerId);
    console.log(`[deployment] ${deploymentId} initial startup status: ${initialStatus}`);

    if (isTerminalContainerStatus(initialStatus)) {
      const exitCode = await getContainerExitCode(container.containerId);
      const crashLogs = await getContainerLogs(container.containerId);
      const lastLine = crashLogs.length > 0 ? crashLogs[crashLogs.length - 1] : "No logs produced";
      
      console.error(`[deployment] ${deploymentId} crashed on startup (code ${exitCode}): ${lastLine}`);
      
      for (const line of crashLogs) {
        appendDeploymentLog(deploymentId, line, "stderr");
      }

      await markPersistentSimulationFailed(persistentSim._id);

      await updateSession(deploymentId, {
        status: "failed",
        errorMessage: `Execution environment crashed on startup: ${lastLine}`,
        completedAt: new Date(),
      });
      setTimeout(() => removeContainer(container.containerId), 5000);
      return;
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
        console.log(`[deployment] Log stream closed for ${deploymentId}`);
      },
      (err) => console.error(`[deployment] Stream error for ${deploymentId}:`, err)
    );

    // Monitoring loop
    let checks = 0;
    let isChecking = false;
    const checkExit = setInterval(async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        checks++;
        const sessionState = await getSession(deploymentId);
        if (!sessionState || TERMINAL_DEPLOYMENT_STATUSES.includes(sessionState.status)) {
          clearInterval(checkExit);
          return;
        }

        const status = await getContainerStatus(container.containerId);

        // Log status periodically
        if (checks % 5 === 0) {
          console.log(`[deployment] ${deploymentId} status: ${status}`);
        }

        if (isTerminalContainerStatus(status)) {
          clearInterval(checkExit);
          console.log(`[deployment] Container ${container.containerId} finished with status: ${status}`);

          // Wait a moment for last logs to arrive via stream
          setTimeout(async () => {
            stopStreaming();

            try {
              const exitCode = await getContainerExitCode(container.containerId);
              console.log(`[deployment] ${deploymentId} exit code: ${exitCode}`);

              // Final log sweep to catch anything missed by the stream.
              const finalLogs = await getContainerLogs(container.containerId);
              if (finalLogs.length > 0) {
                console.log(`[deployment] Capturing ${finalLogs.length} final log lines for ${deploymentId}`);
                for (const line of finalLogs) {
                  appendDeploymentLog(deploymentId, line, "stdout");
                }
              }

              if (exitCode === 0) {
                const hasVmActual = isStage1 ? false : session.nodes.some((node: any) => node.serviceId === "ec2" || node.serviceId === "azure_vm" || node.serviceId === "gcp_compute");
                const { state, outputs } = await captureTerraformArtifactsWithRetry(
                  container.containerId,
                  deploymentId,
                  options.provider,
                  hasVmActual
                );

                if (!state) {
                  await markPersistentSimulationFailed(persistentSim._id);
                  await updateSession(deploymentId, {
                    status: "failed",
                    errorMessage: `Terraform completed, but Rabbittize could not capture raw Terraform state. Please redeploy.`,
                    completedAt: new Date(),
                  });
                  return;
                }

                if (isStage1) {
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

                  const existingSim = await PersistentSimulationModel.findOne({
                    _id: persistentSim._id,
                    "deployments.deploymentId": deploymentId
                  });

                  if (existingSim) {
                    await PersistentSimulationModel.updateOne(
                      { _id: persistentSim._id, "deployments.deploymentId": deploymentId },
                      {
                        $set: {
                          "deployments.$.status": "active",
                          "deployments.$.state": state,
                          "deployments.$.outputs": finalOutputs,
                        }
                      }
                    );
                  } else {
                    await PersistentSimulationModel.findByIdAndUpdate(persistentSim._id, {
                      $push: {
                        deployments: {
                          deploymentId,
                          label: session.name || "ECR Registry",
                          status: "active",
                          provider: options.provider,
                          region: deploymentRegion,
                          hcl: hcl,
                          state,
                          outputs: finalOutputs,
                          createdAt: new Date(),
                        }
                      }
                    });
                  }

                  await updateSession(deploymentId, {
                    status: "awaiting_image_upload",
                    outputs,
                  });

                  appendDeploymentLog(
                    deploymentId,
                    `[runtime] Stage 1 (container registry creation) completed successfully. Awaiting image upload...`,
                    "stdout"
                  );
                  return;
                }

                if (hasVmActual && !outputs.private_key?.value) {
                  await markPersistentSimulationFailed(persistentSim._id);
                  await updateSession(deploymentId, {
                    status: "failed",
                    errorMessage: `Terraform completed, but Rabbittize could not capture generated PEM key. Please redeploy.`,
                    completedAt: new Date(),
                  });
                  return;
                }

                // Verify deployed resources
                if (!isStage1) {
                  try {
                    await verifyDeployedResources(deploymentId, options.provider, session.nodes, outputs, {
                      ...options,
                      region: deploymentRegion
                    });
                  } catch (err: any) {
                    console.error(`[deployment] verifyDeployedResources failed:`, err);
                  }
                }

                // Update persistent simulation with results
                const finalOutputs: any = {
                  instance_ips: outputs.instance_ips?.value || [],
                };

                if (outputs.private_key?.value) {
                  finalOutputs.private_key = encrypt(outputs.private_key.value);
                }
                if (outputs.key_name?.value) {
                  finalOutputs.key_name = outputs.key_name.value;
                }

                // Copy any other outputs (like vm_info_*) so they are persistent
                for (const key of Object.keys(outputs)) {
                  if (key.startsWith("vm_info_") || key.startsWith("ecr_url_") || key.startsWith("apigateway_url_") || key.startsWith("lb_info_")) {
                    finalOutputs[key] = outputs[key];
                  }
                }


                const existingSim = await PersistentSimulationModel.findOne({
                  _id: persistentSim._id,
                  "deployments.deploymentId": deploymentId
                });

                if (existingSim) {
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
                } else {
                  await PersistentSimulationModel.findByIdAndUpdate(persistentSim._id, {
                    $set: {
                      status: "active",
                      "terraform.state": state,
                      "terraform.outputs": finalOutputs
                    },
                    $push: {
                      deployments: {
                        deploymentId,
                        label: `${session.name || "Simulation"} - ${new Date().toLocaleString()}`,
                        status: "active",
                        provider: options.provider || "aws",
                        region: deploymentRegion,
                        hcl,
                        state,
                        outputs: finalOutputs,
                        createdAt: new Date(),
                      }
                    }
                  });
                }

                await updateSession(deploymentId, {
                  status: "complete",
                  completedAt: new Date(),
                  outputs
                });
              } else {
                const state = await getState(container.containerId, deploymentId, options.provider);

                // If state exists (partial deployment), save it so user can destroy leaked resources.
                if (state) {
                  await PersistentSimulationModel.findByIdAndUpdate(persistentSim._id, {
                    $set: { "terraform.state": state },
                  });
                }
                await markPersistentSimulationFailed(
                  persistentSim._id,
                  state ? {
                    deploymentId,
                    label: `${session.name || "Simulation"} - ${new Date().toLocaleString()} (Failed)`,
                    provider: options.provider || "aws",
                    region: deploymentRegion,
                    hcl,
                    state,
                    outputs: {},
                  } : undefined
                );
                const extractedErr = extractErrorMessage(finalLogs, `Terraform failed (exit code ${exitCode}). Check logs for details.`);
                await updateSession(deploymentId, {
                  status: "failed",
                  errorMessage: extractedErr,
                  completedAt: new Date(),
                });
              }
            } catch (err: any) {
              console.error(`[deployment] Unhandled error during container exit processing for ${deploymentId}:`, err);
              await updateSession(deploymentId, {
                status: "failed",
                errorMessage: `Internal backend error during deployment completion: ${err.message}`,
                completedAt: new Date(),
              });
              await markPersistentSimulationFailed(persistentSim._id).catch(() => {});
            } finally {
              earlyOutputCaptures.delete(deploymentId);
              // Auto-remove container
              setTimeout(() => removeContainer(container.containerId), 15000);
            }
          }, 2000);
        } else {
          isChecking = false;
        }
      } catch (err: any) {
        clearInterval(checkExit);
        stopStreaming();
        console.error(`[deployment] Monitor failed for ${deploymentId}:`, err);
        await markPersistentSimulationFailed(persistentSim._id).catch(() => {});
        await updateSession(deploymentId, {
          status: "failed",
          errorMessage: `Deployment monitor failed: ${err?.message || "unknown error"}`,
          completedAt: new Date(),
        }).catch(() => {});
        setTimeout(() => removeContainer(container.containerId), 5000);
      }
    }, 3000);

    // Hard watchdog
    setTimeout(async () => {
      const s = await getSession(deploymentId);
      if (s?.status === "running") {
        console.warn(`[deployment] Watchdog triggered for ${deploymentId}`);
        await stopContainer(container.containerId);
        await markPersistentSimulationFailed(persistentSim._id);
        await updateSession(deploymentId, {
          status: "timed_out",
          errorMessage: "Deployment exceeded 30 minute limit",
          completedAt: new Date()
        });
        setTimeout(() => removeContainer(container.containerId), 5000);
      }
    }, DEPLOYMENT_TIMEOUT_MS);

  } catch (err: any) {
    console.error(`[deployment] Critical error for ${deploymentId}:`, err);
    await markPersistentSimulationFailed(persistentSim._id);
    await updateSession(deploymentId, {
      status: "failed",
      errorMessage: err.message || "Failed to start execution environment",
      completedAt: new Date(),
    });
    if (container?.containerId) {
      setTimeout(() => removeContainer(container.containerId), 5000);
    }
  }
}

