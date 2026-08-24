import { authFetch } from "@/lib/auth-fetch";
import { emitActionExecutionEvent } from "@/lib/action-events";

type SimulationActionStatus = "created" | "executing" | "completed" | "failed" | "simulated";

interface SimulationActionLogInput {
  actionId: string;
  displayName: string;
  status?: SimulationActionStatus;
  region?: string;
  simulationId?: string | null;
  simulationName?: string;
  target?: {
    resourceId?: string;
    resourceName?: string;
  };
  metadata?: Record<string, unknown>;
  reasoning?: string;
}

export async function logSimulationAction(input: SimulationActionLogInput): Promise<void> {
  try {
    const response = await authFetch("/api/aws/actions/simulation-log", {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({
        ...input,
        status: input.status || "completed",
      }),
    });
    const data = await response.json();
    if (data.success) {
      emitActionExecutionEvent({
        actionRequestId: data.actionRequest?._id,
        actionId: data.actionRequest?.actionId || input.actionId,
        status: data.actionRequest?.status || input.status || "completed",
        message: data.actionRequest?.errorMessage || data.actionRequest?.reasoning || input.reasoning,
        source: "simulation",
      });
    }
  } catch (error) {
    console.warn("[simulation] Failed to log action history entry:", error);
  }
}
