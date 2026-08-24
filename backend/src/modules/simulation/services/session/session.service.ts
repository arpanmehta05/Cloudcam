import {
  LocalOrchestrator,
  EcsFargateOrchestrator,
} from "../orchestrator/simulation-orchestrator";
import type { SimulationOrchestrator } from "../orchestrator/simulation-orchestrator";
import type {
  SimulationConfig,
  SimulationSession,
} from "../../models/simulation.model";
import { getSession, removeSession } from "./session-store";

const useEcs = process.env.SIMULATION_USE_ECS === "true";
const orchestrator: SimulationOrchestrator = useEcs
  ? new EcsFargateOrchestrator()
  : new LocalOrchestrator();

/**
 * Creates a new active simulation session using the configured orchestrator.
 */
export async function createSessionService(cfg: SimulationConfig): Promise<SimulationSession> {
  return await orchestrator.createSession(cfg);
}

/**
 * Retrieves the status of an active session, verifying expiration.
 */
export async function getSessionStatusService(id: string): Promise<SimulationSession> {
  const session = await getSession(id);
  if (!session) {
    throw new Error("Session not found");
  }

  // Remove expired sessions on read
  if (new Date() > new Date(session.expiresAt)) {
    await removeSession(session.id);
    throw new Error("Session expired");
  }

  return session;
}

/**
 * Terminates an active simulation session.
 */
export async function terminateSessionService(id: string): Promise<SimulationSession> {
  const session = await orchestrator.terminate(id);
  if (!session) {
    throw new Error("Session not found");
  }
  return session;
}
