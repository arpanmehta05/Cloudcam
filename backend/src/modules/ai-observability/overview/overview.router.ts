import { Router } from "express";
import { overviewGet } from "./overview.controller";

export const overviewRouter = Router();

overviewRouter.get("/overview", overviewGet);
