import { Router } from "express";
import { promptInsightsGet } from "./prompt-insights.controller";

export const promptInsightsRouter = Router();

promptInsightsRouter.get("/recommendations/prompts", promptInsightsGet);
