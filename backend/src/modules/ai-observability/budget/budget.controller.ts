import { Request, Response } from "express";
import * as budgetService from "../services/budget/budget.service";
import * as budgetEnforcementService from "../services/budget/enforcement.service";

// GET /api/ai-observability/budget
export async function budgetGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const status = await budgetService.getBudgetStatus(userId);
    return res.json({ success: true, budget: status });
  } catch (error) {
    console.error("ai-observability budgetGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch budget" });
  }
}

// POST /api/ai-observability/budget
export async function budgetPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const {
      monthlyLimit,
      dailyLimit,
      alertThresholdPercent,
      autoPause,
      enabled,
    } = req.body || {};

    if (typeof monthlyLimit !== "number" || monthlyLimit <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "monthlyLimit must be a positive number",
        });
    }

    const rule = await budgetService.createBudgetRule(userId, {
      monthlyLimit,
      dailyLimit,
      alertThresholdPercent,
      autoPause,
      enabled,
    });

    return res.status(201).json({ success: true, budget: rule });
  } catch (error: any) {
    if (error?.message?.includes("already exists")) {
      return res.status(409).json({ success: false, error: error.message });
    }
    console.error("ai-observability budgetPost error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to create budget rule" });
  }
}

// PUT /api/ai-observability/budget/:id
export async function budgetPut(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const ruleId = req.params.id as string;
    const {
      monthlyLimit,
      dailyLimit,
      alertThresholdPercent,
      autoPause,
      enabled,
    } = req.body || {};

    const rule = await budgetService.updateBudgetRule(userId, ruleId, {
      monthlyLimit,
      dailyLimit,
      alertThresholdPercent,
      autoPause,
      enabled,
    });

    if (!rule) {
      return res
        .status(404)
        .json({
          success: false,
          error: "Budget rule not found or nothing to update",
        });
    }

    return res.json({ success: true, budget: rule });
  } catch (error) {
    console.error("ai-observability budgetPut error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to update budget rule" });
  }
}

// POST /api/ai-observability/budget/enforce
export async function budgetEnforcePost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const result = await budgetEnforcementService.enforceBudget(userId);

    if (!result) {
      return res.json({
        success: true,
        message: "No budget rule configured",
        enforcement: null,
      });
    }

    return res.json({ success: true, enforcement: result });
  } catch (error) {
    console.error("ai-observability budgetEnforcePost error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to enforce budget" });
  }
}
