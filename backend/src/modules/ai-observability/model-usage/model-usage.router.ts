import { Router } from "express";
import { modelsGet } from "./model-usage.controller";

export const modelUsageRouter = Router();

modelUsageRouter.get("/models", modelsGet);
