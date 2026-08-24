import { Router } from "express";
import {
  savedViewsDelete,
  savedViewsGet,
  savedViewsPatch,
  savedViewsPost,
} from "./saved-views.controller";

export const savedViewsRouter = Router();

savedViewsRouter.get("/views", savedViewsGet);
savedViewsRouter.post("/views", savedViewsPost);
savedViewsRouter.patch("/views/:id", savedViewsPatch);
savedViewsRouter.delete("/views/:id", savedViewsDelete);
