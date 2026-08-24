import { Router } from "express";
import { feedbackGet, feedbackPost } from "./feedback.controller";

export const feedbackRouter = Router();

feedbackRouter.get("/feedback", feedbackGet);
feedbackRouter.post("/feedback", feedbackPost);
