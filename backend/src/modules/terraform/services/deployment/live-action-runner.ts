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

export async function runLiveActionDeployment(
  deploymentId: string,
  hcl: string,
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

  await updateSession(deploymentId, { status: "running", region: deploymentRegion });
  console.log(`[deployment] Starting LIVE ACTION run for ${deploymentId} in ${deploymentRegion}`);

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

    // Wait for container to settle
    await new Promise(resolve => setTimeout(resolve, 3000));
    const initialStatus = await getContainerStatus(container.containerId);

    if (isTerminalContainerStatus(initialStatus)) {
      const exitCode = await getContainerExitCode(container.containerId);
      const crashLogs = await getContainerLogs(container.containerId);
      const lastLine = crashLogs.length > 0 ? crashLogs[crashLogs.length - 1] : "No logs produced";
      
      console.error(`[deployment] ${deploymentId} crashed on startup (code ${exitCode}): ${lastLine}`);
      for (const line of crashLogs) {
        appendDeploymentLog(deploymentId, line, "stderr");
      }

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
      },
      () => console.log(`[deployment] Log stream closed for ${deploymentId}`),
      (err) => console.error(`[deployment] Stream error for ${deploymentId}:`, err)
    );

    // Monitoring loop
    let checks = 0;
    const checkExit = setInterval(async () => {
      try {
        checks++;
        const sessionState = await getSession(deploymentId);
        if (!sessionState || TERMINAL_DEPLOYMENT_STATUSES.includes(sessionState.status)) {
          clearInterval(checkExit);
          return;
        }

        const status = await getContainerStatus(container.containerId);

        if (isTerminalContainerStatus(status)) {
          clearInterval(checkExit);
          console.log(`[deployment] Container ${container.containerId} finished with status: ${status}`);

          setTimeout(async () => {
            stopStreaming();

            try {
              const exitCode = await getContainerExitCode(container.containerId);
              const finalLogs = await getContainerLogs(container.containerId);
              for (const line of finalLogs) {
                appendDeploymentLog(deploymentId, line, "stdout");
              }

              if (exitCode === 0) {
                await updateSession(deploymentId, {
                  status: "complete",
                  completedAt: new Date()
                });
              } else {
                const extractedErr = extractErrorMessage(finalLogs, `Live Action failed (exit code ${exitCode}). Check logs for details.`);
                await updateSession(deploymentId, {
                  status: "failed",
                  errorMessage: extractedErr,
                  completedAt: new Date(),
                });
              }
            } catch (err: any) {
              console.error(`[deployment] Error during container exit processing for ${deploymentId}:`, err);
              await updateSession(deploymentId, {
                status: "failed",
                errorMessage: `Internal backend error during deployment completion: ${err.message}`,
                completedAt: new Date(),
              });
            } finally {
              setTimeout(() => removeContainer(container.containerId), 15000);
            }
          }, 2000);
        }
      } catch (err: any) {
        clearInterval(checkExit);
        stopStreaming();
        console.error(`[deployment] Monitor failed for ${deploymentId}:`, err);
        await updateSession(deploymentId, {
          status: "failed",
          errorMessage: `Deployment monitor failed: ${err?.message || "unknown error"}`,
          completedAt: new Date(),
        }).catch(() => {});
        setTimeout(() => removeContainer(container.containerId), 5000);
      }
    }, 2000);

  } catch (err: any) {
    console.error(`[deployment] Container start failed for ${deploymentId}:`, err);
    await updateSession(deploymentId, {
      status: "failed",
      errorMessage: `Failed to create isolated execution environment: ${err.message}`,
      completedAt: new Date(),
    });
    if (container?.containerId) {
      setTimeout(() => removeContainer(container.containerId), 5000);
    }
  }
}

