import { getState, getOutputs } from "../container-manager";
import { updateSession, appendDeploymentLog } from "./store";

const ARTIFACT_CAPTURE_RETRIES = 12;
const ARTIFACT_CAPTURE_RETRY_MS = 5000;
const EARLY_OUTPUT_CAPTURE_RETRIES = 3;
const EARLY_OUTPUT_CAPTURE_RETRY_MS = 1500;
export const earlyOutputCaptures = new Set<string>();

async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export function recoverTerraformOutputs(outputs: any, state: any): any {
  const recovered = { ...(outputs || {}) };
  if (!recovered.private_key?.value && state?.outputs?.private_key?.value) {
    recovered.private_key = {
      value: state.outputs.private_key.value,
      sensitive: true,
      type: state.outputs.private_key.type || "string",
    };
  }
  if (!recovered.key_name?.value && state?.outputs?.key_name?.value) {
    recovered.key_name = {
      value: state.outputs.key_name.value,
      sensitive: Boolean(state.outputs.key_name.sensitive),
      type: state.outputs.key_name.type || "string",
    };
  }
  if (!recovered.private_key?.value && state?.resources && Array.isArray(state.resources)) {
    const keyResource = state.resources.find((resource: any) => resource.type === "tls_private_key");
    const privateKey = keyResource?.instances?.find((instance: any) => instance?.attributes?.private_key_pem)
      ?.attributes?.private_key_pem;
    if (privateKey) {
      recovered.private_key = {
        value: privateKey,
        sensitive: true,
        type: "string",
      };
    }
  }
  return recovered;
}

export function hasRequiredTerraformArtifacts(state: any, outputs: any, hasVm: boolean): boolean {
  return Boolean(state && (!hasVm || outputs?.private_key?.value));
}

export async function captureTerraformArtifactsWithRetry(
  containerId: string,
  deploymentId: string,
  provider: "aws" | "azure" | "gcp" | undefined,
  hasVm: boolean
): Promise<{ state: any; outputs: any }> {
  let latestState: any = null;
  let latestOutputs: any = {};

  for (let attempt = 1; attempt <= ARTIFACT_CAPTURE_RETRIES; attempt++) {
    latestState = await getState(containerId, deploymentId, provider);
    latestOutputs = recoverTerraformOutputs(await getOutputs(containerId, deploymentId, provider), latestState);

    if (hasRequiredTerraformArtifacts(latestState, latestOutputs, hasVm)) {
      if (attempt > 1) {
        console.log(`[deployment] Captured Terraform artifacts for ${deploymentId} after ${attempt} attempts`);
      }
      return { state: latestState, outputs: latestOutputs };
    }

    const missing = [
      !latestState ? "state" : null,
      hasVm && !latestOutputs?.private_key?.value ? "private_key" : null,
    ].filter(Boolean).join(", ");

    if (attempt < ARTIFACT_CAPTURE_RETRIES) {
      console.warn(
        `[deployment] Terraform artifact capture incomplete for ${deploymentId} ` +
        `(attempt ${attempt}/${ARTIFACT_CAPTURE_RETRIES}; missing: ${missing || "unknown"}). Retrying...`
      );
      await wait(ARTIFACT_CAPTURE_RETRY_MS);
    }
  }

  return { state: latestState, outputs: latestOutputs };
}

export async function hydrateDeploymentOutputsEarly(
  containerId: string,
  deploymentId: string,
  provider: "aws" | "azure" | "gcp" | undefined,
  nodes: any[]
): Promise<void> {
  if (earlyOutputCaptures.has(deploymentId)) return;
  earlyOutputCaptures.add(deploymentId);

  const hasVm = nodes.some((node: any) =>
    node.serviceId === "ec2" ||
    node.serviceId === "azure_vm" ||
    node.serviceId === "gcp_compute"
  );

  for (let attempt = 1; attempt <= EARLY_OUTPUT_CAPTURE_RETRIES; attempt++) {
    try {
      const state = await getState(containerId, deploymentId, provider);
      const outputs = recoverTerraformOutputs(await getOutputs(containerId, deploymentId, provider), state);

      if (outputs?.private_key?.value || (!hasVm && Object.keys(outputs || {}).length > 0)) {
        await updateSession(deploymentId, { outputs });
        appendDeploymentLog(
          deploymentId,
          "[runtime] Terraform outputs captured; generated PEM is ready to download.",
          "stdout"
        );
        return;
      }
    } catch (err: any) {
      console.warn(`[deployment] hydrateDeploymentOutputsEarly failed (attempt ${attempt}):`, err.message);
    }
    if (attempt < EARLY_OUTPUT_CAPTURE_RETRIES) {
      await wait(EARLY_OUTPUT_CAPTURE_RETRY_MS);
    }
  }
}
