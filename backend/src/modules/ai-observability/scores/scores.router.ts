import { Router } from "express";
import {
  scoreConfigsDelete,
  scoreConfigsGet,
  scoreConfigsPatch,
  scoreConfigsPost,
} from "./scores.controller";
import {
  scoreAnalyticsGet,
  scoreComparisonGet,
} from "./score-analytics.controller";

export const scoresRouter = Router();

scoresRouter.get("/score-configs", scoreConfigsGet);
scoresRouter.post("/score-configs", scoreConfigsPost);
scoresRouter.patch("/score-configs/:id", scoreConfigsPatch);
scoresRouter.delete("/score-configs/:id", scoreConfigsDelete);
scoresRouter.get("/scores/analytics", scoreAnalyticsGet);
scoresRouter.get("/scores/comparison", scoreComparisonGet);
