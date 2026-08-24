// Client-side types for the simulation session API

export type SimulationStatus =
  | "pending"
  | "starting"
  | "provisioning"
  | "configuring"
  | "initializing"
  | "checking"
  | "ready"
  | "error"
  | "terminated"
  | "timed_out";

export type StepStatus = "pending" | "running" | "done" | "error";

export interface SimulationStep {
  key: string;
  label: string;
  status: StepStatus;
}

export interface SimulationResponse {
  id: string;
  status: SimulationStatus;
  steps: SimulationStep[];
  progress: number;
  orchestrator: "local" | "ecs";
  createdAt: string;
  errorMessage?: string;
}

export interface SsePayload {
  id: string;
  status: SimulationStatus;
  steps: SimulationStep[];
  progress: number;
}
