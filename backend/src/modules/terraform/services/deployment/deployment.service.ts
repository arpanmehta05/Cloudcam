import { isDockerAvailable, ensureImage } from "../../../../services/container-manager";
import { createSession, updateSession, appendDeploymentLog, onDeploymentLog, onDeploymentUpdate, getSession } from "./store";
import { PersistentSimulationModel } from "../../../../models/simulation-persistent.model";
import { randomUUID } from "crypto";
import type { Response } from "express";
import { DOCKER_UNAVAILABLE_MESSAGE, destroyPersistentSimulation, type DestroyProviderOptions } from "./runner-controller";
export async function startDeployment(
  userId: string,
  nodes: any[],
  edges: any[],
  region: string,
  name?: string,
  draftId?: string
): Promise<{ deploymentId: string }> {
  const dockerOk = await isDockerAvailable();
  if (!dockerOk) throw new Error(DOCKER_UNAVAILABLE_MESSAGE);

  const imageReady = await ensureImage();
  if (!imageReady) {
    throw new Error("Docker runner images are currently compiling or missing. Please try again in a few minutes.");
  }

  const deploymentId = randomUUID();
  await createSession(deploymentId, userId, nodes, edges, region, name, draftId);

  return { deploymentId };
}

export async function startHclDeployment(
  userId: string,
  nodes: any[],
  edges: any[],
  region: string,
  hcl: string,
  name?: string,
  draftId?: string
): Promise<{ deploymentId: string }> {
  const dockerOk = await isDockerAvailable();
  if (!dockerOk) throw new Error(DOCKER_UNAVAILABLE_MESSAGE);

  const imageReady = await ensureImage();
  if (!imageReady) {
    throw new Error("Docker runner images are currently compiling or missing. Please try again in a few minutes.");
  }

  const deploymentId = randomUUID();
  await createSession(deploymentId, userId, nodes, edges, region, name, draftId, hcl);

  return { deploymentId };
}

export async function startPersistentSimulationDestroy(
  userId: string,
  simulationId: string,
  targetDeploymentId: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  region: string,
  providerOptions: DestroyProviderOptions = {}
): Promise<{ destroySessionId: string }> {
  const destroySessionId = `destroy-${randomUUID()}`;
  const sim = await PersistentSimulationModel.findOne({ _id: simulationId, userId }).select("name");
  const simName = sim?.name || "Untitled Simulation";
  await createSession(destroySessionId, userId, [], [], region, `Destroy ${simName}`, simulationId);
  await updateSession(destroySessionId, { status: "running" });

  destroyPersistentSimulation(
    userId,
    simulationId,
    targetDeploymentId,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
    destroySessionId,
    providerOptions
  ).catch(async (err) => {
    console.error(`[destroy] Critical error for ${destroySessionId}:`, err);
    await appendDeploymentLog(destroySessionId, err?.message || "Destroy failed", "stderr");
    await updateSession(destroySessionId, {
      status: "failed",
      errorMessage: err?.message || "Destroy failed",
      completedAt: new Date(),
    });
  });

  return { destroySessionId };
}

export async function setupSseStream(res: Response, deploymentId: string, userId: string): Promise<void> {
  if (res.headersSent) {
    console.warn(`[deployment] Headers already sent for session stream ${deploymentId}`);
  } else {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
  }

  const send = (event: string, data: any) => {
    if (res.writableEnded || res.finished) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error("[deployment] SSE write error:", err);
      cleanup();
    }
  };

  const sendSessionStatus = (session: any) => {
    send("status", {
      status: session.status,
      containerId: session.containerId,
      error: session.errorMessage,
      completedAt: session.completedAt,
      outputs: session.outputs || {},
    });
  };

  // Heartbeat
  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.finished) {
      try {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
      } catch (err) {
        console.error("[deployment] SSE heartbeat write error:", err);
        cleanup();
      }
    }
  }, 10000);

  let closed = false;
  let unsubLog: () => void = () => {};
  let unsubUpdate: () => void = () => {};
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubLog();
    unsubUpdate();
    if (!res.writableEnded && !res.finished) {
      try {
        res.end();
      } catch (err) {
        console.error("[deployment] SSE end error:", err);
      }
    }
  };

  res.on("close", cleanup);

  try {
    // Subscribe before replaying buffered logs so no live line is missed between DB read and listener setup.
    unsubLog = onDeploymentLog(deploymentId, (log) => send("log", log));
    unsubUpdate = onDeploymentUpdate(deploymentId, (session) => {
      sendSessionStatus(session);
      if (["complete", "failed", "cancelled", "timed_out"].includes(session.status)) {
        send(session.status === "complete" ? "complete" : "failed", {
          status: session.status,
          error: session.errorMessage,
          outputs: session.outputs || {},
        });
        cleanup();
      }
    });

    const session = await getSession(deploymentId);
    if (!session) {
      send("error", { error: "Session not found" });
      return cleanup();
    }
    if (session.userId !== userId) {
      send("error", { error: "Not authorized" });
      return cleanup();
    }

    sendSessionStatus(session);

    if (session.logs) {
      for (const log of session.logs) send("log", log);
    }

    // If already finished, send terminal event immediately
    if (["complete", "failed", "cancelled", "timed_out"].includes(session.status)) {
      send(session.status === "complete" ? "complete" : "failed", { 
        status: session.status,
        error: session.errorMessage,
        outputs: session.outputs || {},
      });
      return cleanup();
    }
  } catch (err: any) {
    console.error(`[deployment] SSE stream setup failed for ${deploymentId}:`, err);
    send("error", { error: err?.message || "Failed to start deployment log stream" });
    cleanup();
  }
}

export {
  resolveGcpCredentialPayload,
  validateAwsCredentials,
  validateGcpCredentials,
} from "./credential-validator";
export {
  runDeployment,
  runLiveActionDeployment,
  cancelDeployment,
  resumeDeployment,
  destroyPersistentSimulation,
} from "./runner-controller";
export { verifyEcrImageExists } from "./registry-image-verifier";
export { verifyDeployedResources } from "./resource-verification";
