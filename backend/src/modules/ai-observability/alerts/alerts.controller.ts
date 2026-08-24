import { Request, Response } from "express";
import * as alertsService from "./alerts.service";
import { resolveAiScope } from "../services/scope.service";
import { NotificationHistory } from "../../../models/notification-history.model";

// GET /api/ai-observability/alerts
export async function alertsGet(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const scope = await resolveAiScope(req, userId);
    const status = req.query.status as string | undefined;
    const alerts = await alertsService.getAlerts(scope.userId, {
      status: status as any,
    });
    return res.json({ success: true, alerts });
  } catch (error) {
    console.error("ai-observability alertsGet error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch alerts" });
  }
}

// PATCH /api/ai-observability/alerts/:id
export async function alertPatch(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const scope = await resolveAiScope(req, userId);
    const alertId = req.params.id as string;
    const { status } = req.body || {};

    if (!status || !["acknowledged", "resolved"].includes(status)) {
      return res
        .status(400)
        .json({
          success: false,
          error: "status must be 'acknowledged' or 'resolved'",
        });
    }

    const alert =
      status === "resolved"
        ? await alertsService.resolveAlert(scope.userId, alertId)
        : await alertsService.acknowledgeAlert(scope.userId, alertId);

    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }

    return res.json({ success: true, alert });
  } catch (error) {
    console.error("ai-observability alertPatch error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to update alert" });
  }
}

// POST /api/ai-observability/alerts/evaluate
export async function alertsEvaluatePost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const scope = await resolveAiScope(req, userId);
    const created = await alertsService.evaluateAlertRules(scope);
    const alerts = await alertsService.getAlerts(scope.userId);
    return res.json({
      success: true,
      createdCount: created.length,
      created,
      alerts,
    });
  } catch (error) {
    console.error("ai-observability alertsEvaluatePost error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to evaluate alerts" });
  }
}

// GET /api/auth/notifications/history
export async function getNotificationHistoryHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const history = await NotificationHistory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ success: true, history });
  } catch (error: any) {
    console.error("getNotificationHistoryHandler error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch notification history",
      });
  }
}
