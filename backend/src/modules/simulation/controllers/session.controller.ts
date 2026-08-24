/* eslint-disable import/no-restricted-paths */
import { Request, Response } from "express";
import {
  getSession,
  onSessionUpdate,
  removeSession,
} from "../services/session/session-store";
import {
  createSessionService,
  getSessionStatusService,
  terminateSessionService,
} from "../services/session/session.service";
import type { SimulationConfig } from "../models/simulation.model";

// POST /api/simulation/session
export async function createSession(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || "anonymous";
    const { region = "us-east-1", services = [] } = req.body || {};

    const cfg: SimulationConfig = { region, services, userId };
    const session = await createSessionService(cfg);

    return res.json({
      id: session.id,
      status: session.status,
      steps: session.steps,
      progress: session.progress,
      orchestrator: session.orchestrator,
      createdAt: session.createdAt,
    });
  } catch (err: any) {
    console.error("simulation createSession error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to create simulation session",
    });
  }
}

// GET /api/simulation/session/:id
export async function getSessionStatus(req: Request, res: Response) {
  try {
    const session = await getSessionStatusService(req.params.id as string);

    return res.json({
      id: session.id,
      status: session.status,
      steps: session.steps,
      progress: session.progress,
      orchestrator: session.orchestrator,
      createdAt: session.createdAt,
      errorMessage: session.errorMessage,
    });
  } catch (err: any) {
    console.error("simulation getSessionStatus error:", err);
    return res.status(err.message === "Session not found" || err.message === "Session expired" ? 404 : 500).json({
      success: false,
      error: err.message || "Failed to fetch session status",
    });
  }
}

// GET /api/simulation/session/:id/stream (SSE)
export async function streamSession(req: Request, res: Response) {
  const id = req.params.id as string;
  const session = await getSession(id);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Session not found",
    });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send initial state
  res.write(formatSse("update", session));

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  // Subscribe to updates
  const unsub = onSessionUpdate(id, (updated) => {
    res.write(formatSse("update", updated));

    // Close stream when session reaches a terminal state
    if (
      ["ready", "terminated", "error", "timed_out"].includes(updated.status)
    ) {
      res.write(formatSse("complete", {}));
      cleanup();
    }
  });

  const cleanup = () => {
    clearInterval(heartbeat);
    unsub();
    res.end();
  };

  // Client disconnect cleanup
  req.on("close", cleanup);
}

function formatSse(event: string, data: any): string {
  const payload = JSON.stringify({
    id: data.id,
    status: data.status,
    steps: data.steps,
    progress: data.progress,
    errorMessage: data.errorMessage,
  });

  return `event: ${event}\ndata: ${payload}\n\n`;
}

// POST /api/simulation/session/:id/terminate
export async function terminateSession(req: Request, res: Response) {
  try {
    const session = await terminateSessionService(req.params.id as string);

    return res.json({
      id: session.id,
      status: session.status,
      steps: session.steps,
      progress: session.progress,
    });
  } catch (err: any) {
    console.error("simulation terminateSession error:", err);
    return res.status(err.message === "Session not found" ? 404 : 500).json({
      success: false,
      error: err.message || "Failed to terminate session",
    });
  }
}
