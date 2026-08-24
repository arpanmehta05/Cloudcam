import { Router } from "express";
import { requireRole } from "../../auth";
import { bedrockConsoleGet, bedrockSyncPost } from "./bedrock.controller";

export const bedrockRouter = Router();

bedrockRouter.get("/bedrock/console", bedrockConsoleGet);
bedrockRouter.post("/bedrock/sync", requireRole(["admin"]), bedrockSyncPost);
