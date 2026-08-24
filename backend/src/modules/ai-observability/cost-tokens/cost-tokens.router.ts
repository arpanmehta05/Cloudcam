import { Router } from "express";
import {
  costAttributionGet,
  costsGet,
  evaluationCostGet,
  tokensGet,
} from "./cost-tokens.controller";

export const costTokensRouter = Router();

costTokensRouter.get("/tokens", tokensGet);
costTokensRouter.get("/costs", costsGet);
costTokensRouter.get("/costs/attribution", costAttributionGet);
costTokensRouter.get("/costs/evaluation", evaluationCostGet);
