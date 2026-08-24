import { Request, Response } from "express";
import {
  listVpsAlarmRules,
  createVpsAlarmRule,
  updateVpsAlarmRule,
  deleteVpsAlarmRule,
  updateVpsLogAlertPolicy,
} from "../services";
import { logger } from "../../../core/logger";
import { ok, fail } from "../../../shared/responses";

export async function vpsAlarmRulesGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const alarms = await listVpsAlarmRules(userId);
    return res.json(ok({ alarms }));
  } catch (error: any) {
    logger.error("vpsAlarmRulesGet error:", error);
    return res.status(500).json(fail("Failed to fetch VPS alarms"));
  }
}

export async function vpsAlarmRulesPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const alarm = await createVpsAlarmRule(userId, req.body || {});
    return res.json(ok({ alarm }));
  } catch (error: any) {
    logger.error("vpsAlarmRulesPost error:", error);
    return res
      .status(400)
      .json(fail(error?.message || "Failed to create VPS alarm"));
  }
}

export async function vpsAlarmRulePatch(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const rawId = req.params.id;
    const ruleId = Array.isArray(rawId) ? String(rawId[0]) : String(rawId);
    const alarm = await updateVpsAlarmRule(userId, ruleId, req.body || {});
    return res.json(ok({ alarm }));
  } catch (error: any) {
    logger.error("vpsAlarmRulePatch error:", error);
    const status = /not found/i.test(error?.message || "") ? 404 : 400;
    return res
      .status(status)
      .json(fail(error?.message || "Failed to update VPS alarm"));
  }
}

export async function vpsAlarmRuleDelete(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const ruleId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const result = await deleteVpsAlarmRule(userId, ruleId);
    if (!result.deleted) {
      return res.status(404).json(fail("Alarm rule not found"));
    }
    return res.json(ok(result));
  } catch (error: any) {
    logger.error("vpsAlarmRuleDelete error:", error);
    return res.status(500).json(fail("Failed to delete VPS alarm"));
  }
}

export async function vpsLogAlertPolicyPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const { errorSignatureThreshold, windowMinutes, cooldownMinutes } =
      req.body || {};

    const result = await updateVpsLogAlertPolicy(userId, {
      errorSignatureThreshold: errorSignatureThreshold
        ? parseInt(errorSignatureThreshold, 10)
        : undefined,
      windowMinutes: windowMinutes ? parseInt(windowMinutes, 10) : undefined,
      cooldownMinutes: cooldownMinutes
        ? parseInt(cooldownMinutes, 10)
        : undefined,
    });

    return res.json(result);
  } catch (error: any) {
    logger.error("vpsLogAlertPolicyPost error:", error);
    return res
      .status(500)
      .json(fail(error?.message || "Failed to update alert policy"));
  }
}
