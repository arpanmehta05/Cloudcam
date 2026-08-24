import { execFile, spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { config } from "../../../../config/env";
import { ContainerInfo } from "../container-manager";

const execAsync = promisify(execFile);
const IMAGE = "rabbittize/terraform-runner:latest";
const activeTempDirs = new Map<string, string>();

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync("docker", ["info"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function ensureImage(): Promise<boolean> {
  try {
    await execAsync("docker", ["inspect", IMAGE], { timeout: 5000 });
    console.log("[container-manager] Found local rabbittize/terraform-runner image. Skipping build.");
    return true;
  } catch {
    console.log("[container-manager] Local runner image not found. Forcing build.");
    return false;
  }
}

export async function buildImage(workspaceDir?: string): Promise<boolean> {
  const baseDir = workspaceDir || join(__dirname, "../../../../../");
  const dockerfilePath = join(baseDir, "Dockerfile.terraform-runner");
  const contextPath = baseDir;
  console.log(`[container-manager] Building terraform-runner image from ${dockerfilePath}`);
  try {
    await execAsync("docker", ["build", "-t", IMAGE, "-f", dockerfilePath, contextPath], { timeout: 300000 });
    return true;
  } catch (err: any) {
    console.error(`[container-manager] Build image failed: ${err.message}`);
    return false;
  }
}

export async function startLocalContainer(
  deploymentId: string,
  hcl: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsSessionToken: string,
  region: string,
  options: any
): Promise<ContainerInfo> {
  const name = `tf-runner-${deploymentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
  await execAsync("docker", ["rm", "-f", name], { timeout: 15000 }).catch(() => {});
  
  const envDir = await mkdtemp(join(tmpdir(), "rw-tf-env-"));
  const envFile = join(envDir, "runner.env");
  const payloadFile = join(envDir, "payload.json");
  
  await writeFile(payloadFile, JSON.stringify({ hcl, state: options.state || null }), "utf8");

  const provider = options.provider || "aws";
  const envLines = [
    `TF_RUN_ID=${deploymentId}`,
    `TF_ACTION=${options.action || "apply"}`,
    `TF_PAYLOAD_URL=file:///workspace/payload.json`,
  ];

  const proxyEnvVars = ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy"];
  for (const key of proxyEnvVars) {
    if (process.env[key]) {
      envLines.push(`${key}=${process.env[key]}`);
    }
  }

  if (provider === "azure") {
    const azure = options.azure;
    if (!azure) throw new Error("Azure credentials are required when deploying to Azure");
    envLines.push(
      `ARM_CLIENT_ID=${azure.clientId}`,
      `ARM_CLIENT_SECRET=${azure.clientSecret}`,
      `ARM_TENANT_ID=${azure.tenantId}`,
      `ARM_SUBSCRIPTION_ID=${azure.subscriptionId}`
    );
  } else if (provider === "gcp") {
    const gcp = options.gcp;
    if (!gcp) throw new Error("GCP credentials are required when deploying to GCP");
    envLines.push(
      `GOOGLE_PROJECT=${gcp.projectId}`,
      `GOOGLE_CREDENTIALS=${JSON.stringify({
        type: "service_account",
        project_id: gcp.projectId,
        client_email: gcp.clientEmail,
        private_key: gcp.privateKey,
      })}`
    );
  } else {
    envLines.push(
      `AWS_ACCESS_KEY_ID=${awsAccessKeyId}`,
      `AWS_SECRET_ACCESS_KEY=${awsSecretAccessKey}`,
      `AWS_SESSION_TOKEN=${awsSessionToken || ""}`,
      `AWS_DEFAULT_REGION=${region}`
    );
  }

  await writeFile(envFile, `${envLines.join("\n")}\n`, "utf8");

  console.log(`[docker] Creating container ${name} for deployment ${deploymentId} with provider ${provider}`);

  const extraArgsStr = process.env.LOCAL_DOCKER_RUN_ARGS || "";
  const extraArgs = extraArgsStr ? extraArgsStr.split(/\s+/).filter(Boolean) : [];
  const hostWorkspacePath = envDir.replace(/\\/g, "/");

  const args = [
    "run", "-d",
    "--name", name,
    "--hostname", name,
    "--memory", "1024m",
    "--cpus", "1.0",
    "-v", "rabbittwatch-tf-cache:/plugin-cache-seed",
    "-v", `${hostWorkspacePath}:/workspace`,
    ...extraArgs,
  ];

  args.push("--env-file", envFile, IMAGE);

  try {
    await execAsync("docker", args, { timeout: 15000 });
    activeTempDirs.set(name, envDir);
    return { containerId: name, name };
  } catch (err: any) {
    await rm(envDir, { recursive: true, force: true }).catch(() => {});
    await execAsync("docker", ["rm", "-f", name], { timeout: 15000 }).catch(() => {});
    throw new Error(`Docker execution failed: ${err.message}`);
  }
}

export async function stopLocalContainer(containerId: string): Promise<void> {
  try {
    await execAsync("docker", ["stop", "-t", "10", containerId], { timeout: 15000 });
  } catch {}
}

export async function removeLocalContainer(containerId: string): Promise<void> {
  const tempDir = activeTempDirs.get(containerId);
  if (tempDir) {
    activeTempDirs.delete(containerId);
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
  try {
    await execAsync("docker", ["rm", "-f", containerId], { timeout: 15000 });
  } catch {}
}

export async function getLocalContainerStatus(containerId: string): Promise<string> {
  try {
    const { stdout } = await execAsync("docker", ["inspect", "--format", "{{.State.Status}}", containerId], { timeout: 15000 });
    return stdout.trim();
  } catch {
    return "gone";
  }
}

export async function getLocalContainerExitCode(containerId: string): Promise<number> {
  try {
    const { stdout } = await execAsync("docker", ["inspect", "--format", "{{.State.ExitCode}}", containerId], { timeout: 15000 });
    return parseInt(stdout.trim());
  } catch {
    return -1;
  }
}

export async function getLocalContainerLogs(containerId: string): Promise<string[]> {
  try {
    const { stdout, stderr } = await execAsync("docker", ["logs", "--tail", "5000", containerId], { timeout: 15000 });
    const merged = stdout + "\n" + stderr;
    return merged.trim().split("\n").filter((l) => l.trim());
  } catch {
    return [];
  }
}

async function copyJsonFromContainer(containerId: string, containerPath: string): Promise<any | null> {
  const dir = await mkdtemp(join(tmpdir(), "rw-tf-"));
  const filePath = join(dir, "artifact.json");
  try {
    await execAsync("docker", ["cp", `${containerId}:${containerPath}`, filePath], { timeout: 15000 });
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getLocalWorkspaceDir(containerId: string): Promise<string> {
  try {
    const { stdout } = await execAsync("docker", ["inspect", "--format", "{{range .Config.Env}}{{println .}}{{end}}", containerId], { timeout: 15000 });
    const runIdLine = stdout
      .split("\n")
      .map(line => line.trim())
      .find(line => line.startsWith("TF_RUN_ID="));
    const runId = runIdLine?.slice("TF_RUN_ID=".length).replace(/[^a-zA-Z0-9_.-]/g, "");
    if (runId) return `/workspace/${runId}`;
  } catch {}
  return `/workspace/${containerId}`;
}

export async function getLocalOutputs(
  containerId: string,
  parseMarkedJsonCallback: (logs: string[], start: string, end: string) => any
): Promise<any> {
  const workspaceDir = await getLocalWorkspaceDir(containerId);
  const copied = await copyJsonFromContainer(containerId, `${workspaceDir}/outputs.json`);
  if (copied) return copied;

  try {
    const { stdout } = await execAsync("docker", ["exec", containerId, "cat", `${workspaceDir}/outputs.json`], { timeout: 15000 });
    return JSON.parse(stdout);
  } catch {
    console.log(`[docker] docker exec failed to get outputs for ${containerId}, trying logs...`);
  }

  try {
    return parseMarkedJsonCallback(await getLocalContainerLogs(containerId), "---BEGIN-OUTPUTS---", "---END-OUTPUTS---") || {};
  } catch (err: any) {
    console.error(`[docker] Failed to parse outputs from logs for ${containerId}:`, err.message);
    return {};
  }
}

export async function getLocalState(
  containerId: string,
  parseMarkedJsonCallback: (logs: string[], start: string, end: string) => any
): Promise<any> {
  const workspaceDir = await getLocalWorkspaceDir(containerId);
  const copied = await copyJsonFromContainer(containerId, `${workspaceDir}/state.json`);
  if (copied) return copied;

  try {
    const { stdout } = await execAsync("docker", ["exec", containerId, "cat", `${workspaceDir}/state.json`], { timeout: 15000 });
    return JSON.parse(stdout);
  } catch {
    console.log(`[docker] state.json not accessible via exec on ${containerId} (likely exited); parsing from logs...`);
  }

  try {
    return parseMarkedJsonCallback(await getLocalContainerLogs(containerId), "---BEGIN-STATE---", "---END-STATE---");
  } catch (err: any) {
    console.error(`[docker] Failed to parse state from logs for ${containerId}:`, err.message);
  }
  return null;
}

export function streamLocalLogs(
  containerId: string,
  onLine: (line: string, source: "stdout" | "stderr") => void,
  onEnd: () => void,
  onError: (err: Error) => void
): () => void {
  const child = spawn("docker", ["logs", "-f", "--timestamps", containerId]);
  const processStream = (stream: any, source: "stdout" | "stderr") => {
    let buffer = "";
    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) onLine(line.trim(), source);
      }
    });
  };
  processStream(child.stdout, "stdout");
  processStream(child.stderr, "stderr");
  child.on("error", onError);
  child.on("close", onEnd);
  return () => {
    try {
      child.kill();
    } catch {}
  };
}
