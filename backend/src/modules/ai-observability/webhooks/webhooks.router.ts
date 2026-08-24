import { Router } from "express";
import { requireRole } from "../../auth";
import {
  webhookDelete,
  webhookDeliveriesGet,
  webhookPatch,
  webhookRotate,
  webhooksGet,
  webhooksPost,
  webhookTest,
} from "./webhooks.controller";

export const webhooksRouter = Router();

webhooksRouter.get("/webhooks", requireRole(["admin"]), webhooksGet);
webhooksRouter.post("/webhooks", requireRole(["admin"]), webhooksPost);
webhooksRouter.patch("/webhooks/:id", requireRole(["admin"]), webhookPatch);
webhooksRouter.post("/webhooks/:id/rotate", requireRole(["admin"]), webhookRotate);
webhooksRouter.post("/webhooks/:id/test", requireRole(["admin"]), webhookTest);
webhooksRouter.get("/webhooks/:id/deliveries", requireRole(["admin"]), webhookDeliveriesGet);
webhooksRouter.delete("/webhooks/:id", requireRole(["admin"]), webhookDelete);
