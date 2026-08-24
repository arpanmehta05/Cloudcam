import { Router } from "express";
import {
  sharedReportPublicGet,
  sharedReportRevoke,
  sharedReportsGet,
  sharedReportsPost,
} from "./shared-reports.controller";

export const publicSharedReportsRouter = Router();

publicSharedReportsRouter.get("/public/reports/:token", sharedReportPublicGet);

export const sharedReportsRouter = Router();

sharedReportsRouter.get("/reports", sharedReportsGet);
sharedReportsRouter.post("/reports", sharedReportsPost);
sharedReportsRouter.post("/reports/:id/revoke", sharedReportRevoke);
