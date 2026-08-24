import { Router } from "express";
import { annotationsGet, annotationsPost } from "./annotations.controller";

export const annotationsRouter = Router();

annotationsRouter.get("/annotations", annotationsGet);
annotationsRouter.post("/annotations", annotationsPost);
