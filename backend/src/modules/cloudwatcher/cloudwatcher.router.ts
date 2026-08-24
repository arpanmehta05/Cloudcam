import { Router } from "express";
import { aiIngestAuth } from "../../middleware/ai-ingest-auth.middleware";
import { authMiddleware } from "../auth";
import {
  agentReportsGet,
  agentsGet,
  reportGet,
  reportPdfGet,
  reportsPost,
  validateReportPost,
} from "./reports.controller";

export const cloudWatcherRouter = Router();

cloudWatcherRouter.post("/reports/validate", validateReportPost);
// Agent Watcher reports are available to every authenticated owner of a
// reports-scoped ingest key; they are not an AI Observability plan entitlement.
cloudWatcherRouter.post(
  "/reports",
  aiIngestAuth("reports:write", { requireAiObservability: false }),
  reportsPost,
);

cloudWatcherRouter.use(authMiddleware);
cloudWatcherRouter.get("/agents", agentsGet);
cloudWatcherRouter.get("/agents/:agent_id/reports", agentReportsGet);
cloudWatcherRouter.get("/reports/:report_id/pdf", reportPdfGet);
cloudWatcherRouter.get("/reports/:report_id", reportGet);
