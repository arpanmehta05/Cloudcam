import { 
  SimulationSessionModel, 
  type SimulationSession, 
  type SimulationStep, 
  type SimulationConfig,
  type SimulationStatus
} from "../../models/simulation.model";
import { upsertSession, updateSessionState, getSession } from "../session/session-store";
import { config } from "../../../../config/env";
import { ECSClient, RunTaskCommand, DescribeTasksCommand, StopTaskCommand } from "@aws-sdk/client-ecs";

const STEPS_TEMPLATE: Array<{ key: string; label: string }> = [
  { key: "provisioning", label: "Provisioning cloud resources" },
  { key: "configuring", label: "Configuring network topology" },
  { key: "initializing", label: "Initializing service mesh" },
  { key: "checking", label: "Running health checks" },
];

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes timeout

async function buildInitialSession(orchestrator: "local" | "ecs", cfg: SimulationConfig): Promise<SimulationSession> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const session = new SimulationSessionModel({
    status: "pending",
    steps: STEPS_TEMPLATE.map((s) => ({ ...s, status: "pending" })),
    progress: 0,
    config: cfg,
    orchestrator,
    expiresAt,
  });

  await session.save();
  return session;
}

export interface SimulationOrchestrator {
  createSession(cfg: SimulationConfig): Promise<SimulationSession>;
  getStatus(id: string): Promise<SimulationSession | null>;
  terminate(id: string): Promise<SimulationSession | null>;
}

// ─── Progress helper ───

async function advanceStep(
  id: string,
  stepIndex: number,
  newStatus: SimulationStep["status"]
): Promise<SimulationSession | null> {
  const session = await getSession(id);
  if (!session || stepIndex >= session.steps.length) return session;

  const step = session.steps[stepIndex];
  step.status = newStatus;

  if (newStatus === "running") {
    step.startedAt = new Date();
    session.status = step.key as SimulationStatus;
  } else if (newStatus === "done") {
    step.completedAt = new Date();
  }

  const doneCount = session.steps.filter((s) => s.status === "done").length;
  session.progress = Math.round((doneCount / session.steps.length) * 100);

  return await updateSessionState(id, { 
    steps: session.steps, 
    progress: session.progress,
    status: session.status
  });
}

// ─── Local Orchestrator (dev) ───

export class LocalOrchestrator implements SimulationOrchestrator {
  private timers = new Map<string, NodeJS.Timeout[]>();

  async createSession(cfg: SimulationConfig): Promise<SimulationSession> {
    const session = await buildInitialSession("local", cfg);
    
    const timers: NodeJS.Timeout[] = [];
    this.timers.set(session.id, timers);

    // Initial state
    await updateSessionState(session.id, {
      status: "starting",
      startedAt: new Date()
    });

    this.runSimulation(session.id);
    return session;
  }

  private async runSimulation(sessionId: string) {
    let stepIndex = 0;
    const session = await getSession(sessionId);
    if (!session) return;

    const runNextStep = async () => {
      const currentSession = await getSession(sessionId);
      if (!currentSession || currentSession.status === "terminated") return;

      if (stepIndex >= currentSession.steps.length) {
        await updateSessionState(sessionId, {
          status: "ready",
          readyAt: new Date(),
          progress: 100
        });
        this.timers.delete(sessionId);
        return;
      }

      await advanceStep(sessionId, stepIndex, "running");

      const timer = setTimeout(async () => {
        await advanceStep(sessionId, stepIndex, "done");
        stepIndex++;
        runNextStep();
      }, 600);

      const sessionTimers = this.timers.get(sessionId);
      if (sessionTimers) sessionTimers.push(timer);
    };

    runNextStep();
  }

  async getStatus(id: string): Promise<SimulationSession | null> {
    return await getSession(id);
  }

  async terminate(id: string): Promise<SimulationSession | null> {
    const session = await this.getStatus(id);
    if (!session || ["terminated", "ready", "error"].includes(session.status)) return session;

    const timers = this.timers.get(id);
    if (timers) {
      timers.forEach(clearTimeout);
      this.timers.delete(id);
    }

    return await updateSessionState(id, {
      status: "terminated",
      terminatedAt: new Date()
    });
  }
}

// ─── ECS Fargate Orchestrator ───

const ecsClient = new ECSClient({ region: config.aws.region });

export class EcsFargateOrchestrator implements SimulationOrchestrator {
  private timers = new Map<string, NodeJS.Timeout[]>();

  private async runSimulation(sessionId: string) {
    let stepIndex = 0;
    const session = await getSession(sessionId);
    if (!session) return;

    const timers: NodeJS.Timeout[] = [];
    this.timers.set(sessionId, timers);

    const runNextStep = async () => {
      const currentSession = await getSession(sessionId);
      if (!currentSession || ["terminated", "error", "ready"].includes(currentSession.status)) {
        this.timers.delete(sessionId);
        return;
      }

      if (stepIndex >= currentSession.steps.length) {
        await updateSessionState(sessionId, {
          status: "ready",
          readyAt: new Date(),
          progress: 100
        });
        this.timers.delete(sessionId);
        return;
      }

      await advanceStep(sessionId, stepIndex, "running");

      const timer = setTimeout(async () => {
        await advanceStep(sessionId, stepIndex, "done");
        stepIndex++;
        runNextStep();
      }, 600);

      const sessionTimers = this.timers.get(sessionId);
      if (sessionTimers) sessionTimers.push(timer);
    };

    runNextStep();
  }

  async createSession(cfg: SimulationConfig): Promise<SimulationSession> {
    const session = await buildInitialSession("ecs", cfg);

    this.launchEcsTask(session.id).catch(async (err) => {
      console.error("simulation ECS launch error:", err);
      await updateSessionState(session.id, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err)
      });
    });

    return session;
  }

  private async launchEcsTask(sessionId: string): Promise<void> {
    const session = await getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const cluster = process.env.SIMULATION_ECS_CLUSTER || "rabbittwatch-simulation";
    const taskDef = process.env.SIMULATION_TASK_DEFINITION || "rabbittwatch-simulation-task:1";
    const subnetId = process.env.SIMULATION_SUBNET_ID;
    const securityGroupId = process.env.SIMULATION_SECURITY_GROUP_ID;

    if (!subnetId || !securityGroupId) {
      throw new Error("SIMULATION_SUBNET_ID and SIMULATION_SECURITY_GROUP_ID must be set for ECS orchestrator");
    }

    await updateSessionState(sessionId, {
      status: "starting",
      startedAt: new Date()
    });

    const cmd = new RunTaskCommand({
      cluster,
      taskDefinition: taskDef,
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [subnetId],
          securityGroups: [securityGroupId],
          assignPublicIp: "DISABLED",
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "simulation",
            environment: [
              { name: "SIMULATION_REGION", value: session.config.region },
              { name: "SIMULATION_ID", value: sessionId },
            ],
          },
        ],
      },
    });

    const result = await ecsClient.send(cmd);
    const task = result.tasks?.[0];
    if (!task?.taskArn) {
      throw new Error("ECS RunTask returned no task");
    }

    await updateSessionState(sessionId, { externalId: task.taskArn });
    this.monitorTask(sessionId, cluster, task.taskArn);
  }

  private monitorTask(sessionId: string, cluster: string, taskId: string): void {
    const startTime = Date.now();

    const check = async () => {
      try {
        const session = await getSession(sessionId);
        if (!session || ["ready", "error", "terminated"].includes(session.status)) return;

        // Timeout check
        if (Date.now() - startTime > SESSION_TIMEOUT_MS) {
          await updateSessionState(sessionId, {
            status: "timed_out",
            errorMessage: "Simulation timed out after 15 minutes"
          });
          await this.terminate(sessionId);
          return;
        }

        const res = await ecsClient.send(
          new DescribeTasksCommand({ cluster, tasks: [taskId] })
        );

        const task = res.tasks?.[0];
        if (!task) return;

        const lastStatus = task.lastStatus;

        if (lastStatus === "RUNNING") {
          if (session.status === "starting") {
            await updateSessionState(sessionId, { status: "provisioning" });
            this.runSimulation(sessionId);
          }
        } else if (lastStatus === "STOPPED") {
          const timers = this.timers.get(sessionId);
          if (timers) {
            timers.forEach(clearTimeout);
            this.timers.delete(sessionId);
          }

          if (task.desiredStatus === "RUNNING") {
            await updateSessionState(sessionId, {
              status: "error",
              errorMessage: task.stoppedReason || "Task stopped unexpectedly"
            });
          } else if (session.status !== "terminated") {
            await updateSessionState(sessionId, {
              status: "ready",
              readyAt: new Date(),
              progress: 100
            });
          }
          return;
        }

        setTimeout(check, 5000);
      } catch (err) {
        console.error("simulation ECS monitor error:", err);
        setTimeout(check, 10000); // Retry later on error
      }
    };

    setTimeout(check, 5000);
  }

  async getStatus(id: string): Promise<SimulationSession | null> {
    return await getSession(id);
  }

  async terminate(id: string): Promise<SimulationSession | null> {
    const session = await this.getStatus(id);
    if (!session || session.status === "terminated") return session;

    const timers = this.timers.get(id);
    if (timers) {
      timers.forEach(clearTimeout);
      this.timers.delete(id);
    }

    if (session.externalId && session.orchestrator === "ecs") {
      try {
        const cluster = process.env.SIMULATION_ECS_CLUSTER || "rabbittwatch-simulation";
        await ecsClient.send(
          new StopTaskCommand({
            cluster,
            task: session.externalId,
            reason: "Terminated via API",
          })
        );
      } catch (err) {
        console.error("simulation ECS stop error:", err);
      }
    }

    return await updateSessionState(id, {
      status: "terminated",
      terminatedAt: new Date()
    });
  }
}
