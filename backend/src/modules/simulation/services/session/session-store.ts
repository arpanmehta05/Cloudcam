import { EventEmitter } from "events";
import { SimulationSessionModel } from "../../models/simulation.model";
import type { SimulationSession } from "../../models/simulation.model";

// Global emitter for session updates to support SSE
export const simulationEmitter = new EventEmitter();
simulationEmitter.setMaxListeners(100);

export async function upsertSession(session: SimulationSession): Promise<void> {
  await session.save();
  simulationEmitter.emit(`update:${session.id}`, session);
}

export async function getSession(id: string): Promise<SimulationSession | null> {
  return await SimulationSessionModel.findById(id);
}

export async function removeSession(id: string): Promise<void> {
  await SimulationSessionModel.findByIdAndDelete(id);
  simulationEmitter.removeAllListeners(`update:${id}`);
}

export function onSessionUpdate(id: string, cb: (session: SimulationSession) => void): () => void {
  const eventName = `update:${id}`;
  simulationEmitter.on(eventName, cb);

  return () => {
    simulationEmitter.off(eventName, cb);
  };
}

// Helper to update session state atomically
export async function updateSessionState(
  id: string, 
  update: Partial<SimulationSession>
): Promise<SimulationSession | null> {
  const session = await SimulationSessionModel.findByIdAndUpdate(
    id,
    { $set: update },
    { returnDocument: "after" }
  );

  if (session) {
    simulationEmitter.emit(`update:${id}`, session);
  }

  return session;
}
