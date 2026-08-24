import { ActionRequest, AuditLog, SavingsRecord, IActionRequest } from "../../../../models/action.model";
import { getActionById } from "../../../../data/action-registry";
import { validateAction } from "./safety-validator";
import { AppError } from "../../../../core/errors/app-error";
import { captureSnapshot, executeActionForTarget, rollbackTarget } from "./action-executor";

const ACTION_MODE = process.env.ACTION_MODE || "simulation";
const DIRECT_LIVE_ACTIONS_ENABLED = process.env.ALLOW_DIRECT_LIVE_ACTIONS === "true";

export async function previewAction(
  actionId: string,
  targets: { resourceId: string; resourceName: string; region: string }[],
  userId: string,
  roleArn?: string,
  externalId?: string
) {
  const actionDef = getActionById(actionId);
  if (!actionDef) {
    throw new AppError({
      code: "ERR_BAD_REQUEST",
      message: `Unknown action: ${actionId}`,
      status: 400,
      retryable: false,
    });
  }

  const safetyResult = await validateAction(actionDef, targets, userId, roleArn, externalId);

  let targetDetails: any[] = [];
  if (targets.length > 0) {
    const snapshots = await Promise.allSettled(
      targets.map((t) => captureSnapshot(actionDef.service, t.resourceId, t.region, userId, roleArn, externalId))
    );
    targetDetails = targets.map((t, i) => ({
      ...t,
      currentState: snapshots[i].status === "fulfilled" ? (snapshots[i] as any).value : null,
    }));
  }

  if (targets.length === 0) {
    safetyResult.warnings.push(
      "No specific targets identified. Add resource IDs (e.g. S3 bucket names, EC2 instance IDs) before executing."
    );
  }

  return {
    actionDef,
    targets: targetDetails,
    safety: safetyResult,
    simulationMode: ACTION_MODE === "simulation",
    estimatedSavings: 0,
  };
}

export async function executeAction(
  requestId: string,
  userId: string,
  roleArn?: string,
  externalId?: string
): Promise<IActionRequest> {
  const actionReq = await ActionRequest.findById(requestId);
  if (!actionReq) throw new Error("Action request not found");
  if (actionReq.userId !== userId) throw new Error("Unauthorized");
  if (actionReq.status !== "approved") {
    throw new AppError({
      code: "ERR_ACTION_REQUIRES_APPROVAL",
      message: `Action must be approved before execution. Current status: ${actionReq.status}`,
      status: 409,
      retryable: false,
    });
  }

  const actionDef = getActionById(actionReq.actionId);
  if (!actionDef) {
    throw new AppError({
      code: "ERR_BAD_REQUEST",
      message: `Unknown action: ${actionReq.actionId}`,
      status: 400,
      retryable: false,
    });
  }

  if (actionDef.service === "ui") {
    return handleUiAction(actionReq, userId);
  }

  const safety = await validateAction(actionDef, actionReq.targets, userId, roleArn, externalId);
  if (safety.blockers.length > 0 || !safety.safe) {
    throw new AppError({
      code: "ERR_ACTION_SAFETY_BLOCKED",
      message: "Action execution blocked by safety checks",
      status: 409,
      retryable: false,
      details: {
        blockers: safety.blockers,
        warnings: safety.warnings,
        dependencyWarnings: safety.dependencyWarnings,
      },
    });
  }

  actionReq.status = "executing";
  actionReq.executedAt = new Date();
  actionReq.targets.forEach((target) => {
    target.status = "pending";
    target.errorMessage = undefined;
    target.executionResult = undefined;
  });
  actionReq.markModified("targets");
  await actionReq.save();

  await createAuditLog("executed", userId, actionReq);

  if (ACTION_MODE === "simulation" || actionReq.simulationMode) {
    return handleSimulationAction(actionReq, userId);
  }

  if (!DIRECT_LIVE_ACTIONS_ENABLED) {
    return handleBlockedLiveAction(actionReq);
  }

  return executeLiveAction(actionReq, actionDef, userId, roleArn, externalId);
}

export async function rollbackAction(
  requestId: string,
  userId: string,
  roleArn?: string,
  externalId?: string
): Promise<IActionRequest> {
  const actionReq = await ActionRequest.findById(requestId);
  if (!actionReq) throw new Error("Action request not found");
  if (actionReq.userId !== userId) throw new Error("Unauthorized");
  if (actionReq.status !== "completed" && actionReq.status !== "partially_failed") {
    throw new Error("Can only rollback completed or partially failed actions");
  }

  const actionDef = getActionById(actionReq.actionId);
  if (!actionDef?.reversible) throw new Error("This action is not reversible");

  try {
    const rollbackCandidates = actionReq.targets.filter(
      (target) => target.status === "completed" || target.status === "rollback_failed"
    );

    for (const target of rollbackCandidates) {
      await rollbackTarget(
        actionReq.actionId, target.resourceId, target.region,
        actionReq.preActionSnapshot?.[target.resourceId],
        userId, roleArn, externalId
      );
      target.status = "rolled_back";
      target.rolledBackAt = new Date();
      target.errorMessage = undefined;
    }

    actionReq.markModified("targets");
    actionReq.status = "rolled_back";
    actionReq.rolledBackAt = new Date();
    await actionReq.save();

    await SavingsRecord.deleteMany({ actionRequestId: actionReq._id.toString() });
    await createAuditLog("rolled_back", userId, actionReq, [{ action: "rollback" }]);

    return actionReq;
  } catch (error: any) {
    await createAuditLog("failed", userId, actionReq, [{ error: `Rollback failed: ${error.message}` }]);
    throw error;
  }
}

// ─── Helpers ───

async function createAuditLog(event: string, userId: string, req: IActionRequest, changes: any[] = []) {
  return AuditLog.create({
    event,
    userId,
    actionId: req.actionId,
    requestId: req._id.toString(),
    targets: req.targets.map((t) => t.resourceId),
    changes,
  });
}

async function handleUiAction(actionReq: IActionRequest, userId: string): Promise<IActionRequest> {
  actionReq.targets.forEach((target) => {
    target.status = "completed";
    target.executionResult = { mode: "audit_log_only" };
  });
  actionReq.markModified("targets");
  actionReq.status = "simulated";
  actionReq.executedAt = new Date();
  actionReq.completedAt = new Date();
  actionReq.postActionResult = {
    type: "ui_audit_log",
    message: "UI-only action recorded in the audit log. No AWS changes were executed.",
  };
  await actionReq.save();

  await AuditLog.create({
    event: "simulated",
    userId,
    actionId: actionReq.actionId,
    requestId: actionReq._id.toString(),
    targets: actionReq.targets.map((t) => t.resourceId),
    changes: [],
    metadata: { source: "ui" },
  });

  return actionReq;
}

async function handleSimulationAction(actionReq: IActionRequest, userId: string): Promise<IActionRequest> {
  actionReq.targets.forEach((target) => {
    target.status = "completed";
    target.executionResult = { mode: "simulation" };
  });
  actionReq.markModified("targets");
  actionReq.status = "simulated";
  actionReq.completedAt = new Date();
  actionReq.postActionResult = { mode: "simulation", message: "Action was simulated — no AWS changes were made." };
  await actionReq.save();

  await createAuditLog("simulated", userId, actionReq, [{ simulation: true }]);
  return actionReq;
}

async function handleBlockedLiveAction(actionReq: IActionRequest): Promise<IActionRequest> {
  actionReq.status = "failed";
  actionReq.failedAt = new Date();
  actionReq.postActionResult = {
    mode: "blocked",
    message: "Live direct actions are disabled. Use simulation mode or the Terraform deployment workflow for live infrastructure changes.",
  };
  actionReq.targets.forEach((target) => {
    target.status = "failed";
    target.errorMessage = actionReq.postActionResult?.message;
  });
  actionReq.markModified("targets");
  await actionReq.save();

  throw new AppError({
    code: "ERR_FORBIDDEN",
    message: actionReq.postActionResult.message,
    status: 409,
    retryable: false,
  });
}

async function executeLiveAction(
  actionReq: IActionRequest,
  actionDef: any,
  userId: string,
  roleArn?: string,
  externalId?: string
): Promise<IActionRequest> {
  try {
    const preSnapshots: Record<string, any> = {};
    for (const target of actionReq.targets) {
      try {
        preSnapshots[target.resourceId] = await captureSnapshot(
          actionDef.service, target.resourceId, target.region, userId, roleArn, externalId
        );
      } catch { /* best effort */ }
    }
    actionReq.preActionSnapshot = preSnapshots;

    const results: Record<string, any> = {};
    const targetErrors: { resourceId: string; error: string }[] = [];
    const completedTargets: IActionRequest["targets"] = [];

    for (const target of actionReq.targets) {
      target.status = "executing";
      actionReq.markModified("targets");
      await actionReq.save();

      try {
        const executionResult = await executeActionForTarget(
          actionReq.actionId,
          target.resourceId,
          target.region,
          userId,
          roleArn,
          externalId,
          target.proposedState
        );

        results[target.resourceId] = executionResult;
        target.status = "completed";
        target.executionResult = executionResult;
        target.errorMessage = undefined;
        completedTargets.push(target);
      } catch (targetError: any) {
        const targetErrorMessage = targetError?.message || "Unknown target execution failure";
        target.status = "failed";
        target.errorMessage = targetErrorMessage;
        target.executionResult = { failed: true };
        targetErrors.push({ resourceId: target.resourceId, error: targetErrorMessage });
      }

      actionReq.markModified("targets");
      await actionReq.save();
    }

    if (targetErrors.length > 0) {
      const rollbackResults: Record<string, any> = {};

      if (actionDef.reversible) {
        for (const target of [...completedTargets].reverse()) {
          try {
            await rollbackTarget(
              actionReq.actionId,
              target.resourceId,
              target.region,
              actionReq.preActionSnapshot?.[target.resourceId],
              userId,
              roleArn,
              externalId
            );
            target.status = "rolled_back";
            target.rolledBackAt = new Date();
            rollbackResults[target.resourceId] = { rolledBack: true };
          } catch (rollbackError: any) {
            target.status = "rollback_failed";
            target.errorMessage = `Rollback failed: ${rollbackError?.message || "unknown"}`;
            rollbackResults[target.resourceId] = {
              rolledBack: false,
              error: rollbackError?.message || "unknown",
            };
          }
        }
      }

      actionReq.postActionResult = {
        results,
        targetErrors,
        rollbackResults,
      };
      actionReq.status = completedTargets.length > 0 ? "partially_failed" : "failed";
      actionReq.failedAt = new Date();
      actionReq.errorMessage = `${targetErrors.length} of ${actionReq.targets.length} target(s) failed`;
      actionReq.markModified("targets");
      await actionReq.save();

      await createAuditLog("failed", userId, actionReq, [{ targetErrors }, { rollbackResults }]);

      throw new AppError({
        code: "ERR_ACTION_EXECUTION_PARTIAL",
        message: actionReq.errorMessage,
        status: 502,
        retryable: false,
        details: {
          targetErrors,
          rollbackResults,
        },
      });
    }

    actionReq.postActionResult = results;
    actionReq.status = "completed";
    actionReq.completedAt = new Date();
    await actionReq.save();

    if (actionReq.estimatedSavings > 0) {
      await SavingsRecord.findOneAndUpdate(
        { userId, actionRequestId: actionReq._id.toString() },
        {
          $setOnInsert: {
            actionId: actionReq.actionId,
            service: actionDef.service,
            estimatedMonthlySavings: actionReq.estimatedSavings,
          },
        },
        { upsert: true }
      );
    }

    await createAuditLog("executed", userId, actionReq, Object.entries(results).map(([id, r]) => ({ resourceId: id, result: r })));

    return actionReq;
  } catch (error: any) {
    if (actionReq.status !== "partially_failed") {
      actionReq.status = "failed";
      actionReq.failedAt = new Date();
      actionReq.errorMessage = error.message || "Unknown execution failure";
      await actionReq.save();
    }

    await createAuditLog("failed", userId, actionReq, [{ error: error.message }]);
    throw error;
  }
}
