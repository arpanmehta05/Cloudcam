import { Router } from "express";
import { errorsGet } from "./errors.controller";

export const errorsRouter = Router();

errorsRouter.get("/errors", errorsGet);
