import { Router } from "express";
import { routingRecommendationsGet } from "./routing-recommendations.controller";

export const routingRecommendationsRouter = Router();

routingRecommendationsRouter.get("/recommendations/routing", routingRecommendationsGet);
