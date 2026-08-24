import { Request, Response } from "express";
import {
  planActions,
  planFromRecommendation,
  createActionRequest,
} from "../services/actions/action-planner";
import { previewAction } from "../services/actions/action-executor";
import { getActionById, ALL_ACTIONS } from "../../../data/action-registry";
import { toErrorResponse } from "../../../core/errors";
import { loadUserCreds } from "./helpers";

const DIRECT_LIVE_ACTIONS_ENABLED = process.env.ALLOW_DIRECT_LIVE_ACTIONS === "true";

export * from "./action-run.controller";
export * from "./action-history.controller";

// POST /api/actions/plan — AI-powered action planning from natural language
export async function actionPlanPost(req: Request, res: Response) {
  try {
    const { message, factSheet, recommendations } = req.body;
    if (!message)
      return res
        .status(400)
        .json({ success: false, error: "Message is required" });

    const plans = await planActions(message, factSheet || "", recommendations);
    res.json({ success: true, plans });
  } catch (error: any) {
    const mapped = toErrorResponse(error);
    console.error("Action plan error:", mapped.body.code, mapped.body.error);
    res.status(mapped.status).json(mapped.body);
  }
}

// POST /api/actions/plan-from-recommendation — Convert a recommendation to action plan
export async function actionPlanFromRecPost(req: Request, res: Response) {
  try {
    const { recommendation, factSheet } = req.body;
    if (!recommendation)
      return res
        .status(400)
        .json({ success: false, error: "Recommendation is required" });

    const plans = await planFromRecommendation(recommendation, factSheet || "");
    res.json({ success: true, plans });
  } catch (error: any) {
    const mapped = toErrorResponse(error);
    console.error(
      "Action plan from rec error:",
      mapped.body.code,
      mapped.body.error,
    );
    res.status(mapped.status).json(mapped.body);
  }
}

// POST /api/actions/preview — Preview an action with safety checks
export async function actionPreviewPost(req: Request, res: Response) {
  try {
    const { actionId, targets } = req.body;
    if (!actionId) {
      return res
        .status(400)
        .json({ success: false, error: "actionId is required" });
    }
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "At least one target is required" });
    }

    const actionDef = getActionById(actionId);
    if (!actionDef) {
      return res
        .status(400)
        .json({ success: false, error: `Unknown action: ${actionId}` });
    }

    const { userId, roleArn, externalId } = await loadUserCreds(req);
    const preview = await previewAction(
      actionId,
      targets,
      userId,
      roleArn,
      externalId,
    );
    res.json({ success: true, preview });
  } catch (error: any) {
    console.error("Action preview error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to preview action",
      });
  }
}

// POST /api/actions/create — Create an action request from a plan
export async function actionCreatePost(req: Request, res: Response) {
  try {
    const { plan, simulationMode } = req.body;
    if (!plan?.actionId)
      return res
        .status(400)
        .json({ success: false, error: "Plan with actionId is required" });
    if (simulationMode === false && !DIRECT_LIVE_ACTIONS_ENABLED) {
      return res.status(409).json({
        success: false,
        error:
          "Live direct actions are disabled. Use simulation mode or the Terraform deployment workflow for live infrastructure changes.",
      });
    }

    const { userId } = await loadUserCreds(req);
    const actionReq = await createActionRequest(
      plan,
      userId,
      simulationMode ?? true,
    );
    res.json({ success: true, actionRequest: actionReq });
  } catch (error: any) {
    const mapped = toErrorResponse(error);
    console.error("Action create error:", mapped.body.code, mapped.body.error);
    res.status(mapped.status).json(mapped.body);
  }
}

// GET /api/actions/registry — Get available actions
export async function actionRegistryGet(_req: Request, res: Response) {
  try {
    res.json({ success: true, actions: ALL_ACTIONS });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
