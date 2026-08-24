import { Request, Response } from "express";
import { executeAction, rollbackAction } from "../services/actions/action-executor";
import { ActionRequest, AuditLog, type ActionStatus } from "../../../models/action.model";
import { toErrorResponse } from "../../../core/errors";
import { loadUserCreds } from "./helpers";

const DIRECT_LIVE_ACTIONS_ENABLED = process.env.ALLOW_DIRECT_LIVE_ACTIONS === "true";

const SIMULATION_LOG_STATUSES = new Set<ActionStatus>([
  "created",
  "executing",
  "completed",
  "failed",
  "simulated",
]);

function normalizeSimulationLogStatus(status: unknown): ActionStatus {
  if (
    typeof status === "string" &&
    SIMULATION_LOG_STATUSES.has(status as ActionStatus)
  ) {
    return status as ActionStatus;
  }
  return "completed";
}

function completedAtForStatus(status: ActionStatus): Date | undefined {
  if (["completed", "failed", "simulated"].includes(status)) return new Date();
  return undefined;
}

// POST /api/actions/approve/:id — Approve an action request for execution
export async function actionApprovePost(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { simulationMode } = req.body || {};
    const { userId } = await loadUserCreds(req);

    const actionReq = await ActionRequest.findOne({ _id: id, userId });
    if (!actionReq)
      return res
        .status(404)
        .json({ success: false, error: "Action not found" });

    if (
      actionReq.status !== "pending_review" &&
      actionReq.status !== "created"
    ) {
      return res.status(409).json({
        success: false,
        error: `Cannot approve action in status: ${actionReq.status}`,
      });
    }
    if (simulationMode === false && !DIRECT_LIVE_ACTIONS_ENABLED) {
      return res.status(409).json({
        success: false,
        error:
          "Live direct actions are disabled. Use simulation mode or the Terraform deployment workflow for live infrastructure changes.",
      });
    }

    actionReq.status = "approved";
    actionReq.approvedAt = new Date();
    if (typeof simulationMode === "boolean") {
      actionReq.simulationMode = simulationMode;
    }
    await actionReq.save();

    await AuditLog.create({
      event: "approved",
      userId,
      actionId: actionReq.actionId,
      requestId: actionReq._id.toString(),
      targets: actionReq.targets.map((t) => t.resourceId),
      changes: [{ simulationMode: actionReq.simulationMode }],
    });

    res.json({ success: true, actionRequest: actionReq });
  } catch (error: any) {
    const mapped = toErrorResponse(error);
    console.error("Action approve error:", mapped.body.code, mapped.body.error);
    res.status(mapped.status).json(mapped.body);
  }
}

// POST /api/actions/execute/:id — Execute a created action
export async function actionExecutePost(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const result = await executeAction(id, userId, roleArn, externalId);
    res.json({ success: true, actionRequest: result });
  } catch (error: any) {
    const mapped = toErrorResponse(error);
    console.error("Action execute error:", mapped.body.code, mapped.body.error);
    res.status(mapped.status).json(mapped.body);
  }
}

// POST /api/actions/rollback/:id — Rollback a completed action
export async function actionRollbackPost(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const result = await rollbackAction(id, userId, roleArn, externalId);
    res.json({ success: true, actionRequest: result });
  } catch (error: any) {
    console.error("Action rollback error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to rollback action",
      });
  }
}

// POST /api/actions/simulation-log — Record a user action from the simulation canvas
export async function actionSimulationLogPost(req: Request, res: Response) {
  try {
    const { userId } = await loadUserCreds(req);
    const {
      actionId,
      displayName,
      status,
      region,
      simulationId,
      simulationName,
      target,
      metadata,
      reasoning,
    } = req.body || {};

    if (!actionId || typeof actionId !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "actionId is required" });
    }

    const normalizedStatus = normalizeSimulationLogStatus(status);
    const completedAt = completedAtForStatus(normalizedStatus);
    const targetRegion =
      typeof region === "string" && region.trim() ? region : "simulation";
    const targetResourceId =
      typeof target?.resourceId === "string" && target.resourceId.trim()
        ? target.resourceId
        : typeof simulationId === "string" && simulationId.trim()
          ? simulationId
          : "simulation-canvas";
    const targetResourceName =
      typeof target?.resourceName === "string" && target.resourceName.trim()
        ? target.resourceName
        : typeof simulationName === "string" && simulationName.trim()
          ? simulationName
          : "Simulation canvas";

    const actionReq = await ActionRequest.create({
      userId,
      actionId: actionId.slice(0, 120),
      displayName:
        typeof displayName === "string" && displayName.trim()
          ? displayName.slice(0, 180)
          : "Simulation action",
      service: "simulation",
      targets: [
        {
          resourceId: targetResourceId,
          resourceName: targetResourceName,
          region: targetRegion,
          status: normalizedStatus === "failed" ? "failed" : "completed",
        },
      ],
      status: normalizedStatus,
      riskLevel: "low",
      reversible: false,
      estimatedSavings: 0,
      safetyWarnings: [],
      dependencyWarnings: [],
      simulationMode: true,
      reasoning:
        typeof reasoning === "string" ? reasoning.slice(0, 500) : undefined,
      errorMessage:
        normalizedStatus === "failed" && typeof reasoning === "string"
          ? reasoning.slice(0, 500)
          : undefined,
      completedAt,
      failedAt: normalizedStatus === "failed" ? new Date() : undefined,
      postActionResult: {
        type: "simulation_user_action",
        simulationId,
        metadata,
      },
    });

    await AuditLog.create({
      event: normalizedStatus === "failed" ? "failed" : "simulated",
      userId,
      actionId: actionReq.actionId,
      requestId: actionReq._id.toString(),
      targets: actionReq.targets.map((t) => t.resourceId),
      changes: [{ displayName: actionReq.displayName, metadata }],
      metadata: { source: "simulation", simulationId },
      timestamp: new Date(),
    });

    res.json({ success: true, actionRequest: actionReq });
  } catch (error: any) {
    console.error("Simulation action log error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to log simulation action",
      });
  }
}
