import { Router } from "express";
import { observationsGet } from "./observations.controller";

export const observationsRouter = Router();

observationsRouter.get("/observations", observationsGet);
