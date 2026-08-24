import { Router } from "express";
import { requireRole } from "../../auth";
import {
  alertPatch,
  alertsEvaluatePost,
  alertsGet,
  getNotificationHistoryHandler,
} from "./alerts.controller";

export const alertsRouter = Router();

alertsRouter.get("/alerts", alertsGet);
alertsRouter.post("/alerts/evaluate", requireRole(["admin"]), alertsEvaluatePost);
alertsRouter.patch("/alerts/:id", requireRole(["admin"]), alertPatch);
alertsRouter.get("/notifications/history", getNotificationHistoryHandler);
