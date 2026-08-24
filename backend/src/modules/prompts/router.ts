import { Router } from "express";
import { authMiddleware } from "../auth";
import {
    createOrUpdatePrompt,
    deletePrompt,
    getPrompts,
} from "./controllers/prompt-playground.controller";
import { playgroundRouter } from "./playground";

const router = Router();

router.use(authMiddleware);

router.get("/", getPrompts);
router.post("/", createOrUpdatePrompt);
router.delete("/:id", deletePrompt);
router.use("/playground", playgroundRouter);

export const promptsRouter = router;
