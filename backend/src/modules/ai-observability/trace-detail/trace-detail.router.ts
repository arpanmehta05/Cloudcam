import { Router } from "express";
import { traceScoresGet } from "./trace-detail-actions.controller";
import { traceDetailGet } from "./trace-detail.controller";

export const traceDetailRouter = Router();

traceDetailRouter.get("/traces/:traceId/scores", traceScoresGet);
traceDetailRouter.get("/traces/:traceId", traceDetailGet);
