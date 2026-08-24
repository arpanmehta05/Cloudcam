import { 
  isFargateMode as getFargateMode,
  startFargateTask,
  stopFargateTask,
  getFargateTaskStatus,
  getFargateTaskExitCode,
  getFargateTaskLogs,
  getFargateOutputs,
  getFargateState,
  streamFargateLogs
} from "./deployment/fargate-runner";

import {
  isDockerAvailable as getLocalDockerAvailable,
  ensureImage as getLocalEnsureImage,
  buildImage as getLocalBuildImage,
  startLocalContainer,
  stopLocalContainer,
  getLocalContainerStatus,
  getLocalContainerExitCode,
  getLocalContainerLogs,
  removeLocalContainer,
  getLocalOutputs,
  getLocalState,
  streamLocalLogs
} from "./deployment/local-runner";

export async function isDockerAvailable(): Promise<boolean> {
  if (isFargateMode()) return true;
  return getLocalDockerAvailable();
}

export async function ensureImage(): Promise<boolean> {
  if (isFargateMode()) return true;
  return getLocalEnsureImage();
}

export async function buildImage(workspaceDir?: string): Promise<boolean> {
  if (isFargateMode()) return true;
  return getLocalBuildImage(workspaceDir);
}

export function isFargateMode(): boolean {
  return getFargateMode();
}

export function isTerminalContainerStatus(status: string): boolean {
  return ["exited", "dead", "gone", "STOPPED"].includes(status);
}

export interface ContainerInfo {
  containerId: string;
  name: string;
  isFargate?: boolean;
}

export async function createAndStartContainer(
  deploymentId: string,
  hcl: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsSessionToken: string,
  region: string,
  options: any = {}
): Promise<ContainerInfo> {
  if (isFargateMode()) {
    return startFargateTask(deploymentId, hcl, awsAccessKeyId, awsSecretAccessKey, awsSessionToken, region, options);
  } else {
    return startLocalContainer(deploymentId, hcl, awsAccessKeyId, awsSecretAccessKey, awsSessionToken, region, options);
  }
}

export async function stopContainer(containerId: string): Promise<void> {
  if (containerId.startsWith("arn:aws:ecs")) {
    return stopFargateTask(containerId);
  } else {
    return stopLocalContainer(containerId);
  }
}

export async function removeContainer(containerId: string): Promise<void> {
  if (containerId.startsWith("arn:aws:ecs")) {
    return stopContainer(containerId).catch(() => {});
  } else {
    return removeLocalContainer(containerId);
  }
}

export async function getContainerStatus(containerId: string): Promise<string> {
  if (containerId.startsWith("arn:aws:ecs")) {
    return getFargateTaskStatus(containerId);
  } else {
    return getLocalContainerStatus(containerId);
  }
}

export async function getContainerExitCode(containerId: string): Promise<number> {
  if (containerId.startsWith("arn:aws:ecs")) {
    return getFargateTaskExitCode(containerId);
  } else {
    return getLocalContainerExitCode(containerId);
  }
}

export async function getContainerLogs(containerId: string): Promise<string[]> {
  if (containerId.startsWith("arn:aws:ecs")) {
    return getFargateTaskLogs(containerId);
  } else {
    return getLocalContainerLogs(containerId);
  }
}

function parseMarkedJson(logs: string[], startMarker: string, endMarker: string): any | null {
  let insideMarker = false;
  const jsonLines: string[] = [];

  for (const line of logs) {
    const content = line.replace(/^\d{4}-\d{2}-\d{2}T[^\s]+\s+/, "");

    if (content.trim() === startMarker) {
      insideMarker = true;
      continue;
    }
    if (content.trim() === endMarker) {
      break;
    }
    if (insideMarker) {
      jsonLines.push(content);
    }
  }

  const json = jsonLines.join("\n").trim();
  if (!json) return null;

  try {
    return JSON.parse(json);
  } catch (err: any) {
    const firstBrace = json.indexOf("{");
    const lastBrace = json.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(json.slice(firstBrace, lastBrace + 1));
      } catch {}
    }
    console.error(`[terraform-runner] Failed to parse marked JSON ${startMarker}:`, err.message);
    return null;
  }
}

export async function getOutputs(
  containerId: string,
  deploymentId?: string,
  provider?: "aws" | "azure" | "gcp"
): Promise<any> {
  if (containerId.startsWith("arn:aws:ecs")) {
    return getFargateOutputs(containerId, deploymentId, provider, parseMarkedJson);
  } else {
    return getLocalOutputs(containerId, parseMarkedJson);
  }
}

export async function getState(
  containerId: string,
  deploymentId?: string,
  provider?: "aws" | "azure" | "gcp"
): Promise<any> {
  if (containerId.startsWith("arn:aws:ecs")) {
    return getFargateState(containerId, deploymentId, provider, parseMarkedJson);
  } else {
    return getLocalState(containerId, parseMarkedJson);
  }
}

export function streamLogs(
  containerId: string,
  onLine: (line: string, source: "stdout" | "stderr") => void,
  onEnd: () => void,
  onError: (err: Error) => void
): () => void {
  if (containerId.startsWith("arn:aws:ecs")) {
    return streamFargateLogs(containerId, onLine, onEnd, onError, getContainerStatus, isTerminalContainerStatus);
  } else {
    return streamLocalLogs(containerId, onLine, onEnd, onError);
  }
}
