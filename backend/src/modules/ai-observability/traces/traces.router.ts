import { Router } from "express";
import { tracesGet } from "./traces.controller";

export const tracesRouter = Router();

tracesRouter.get("/traces", tracesGet);
