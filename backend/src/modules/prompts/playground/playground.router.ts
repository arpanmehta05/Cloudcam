import { Router } from "express";

import { runPlayground } from "./playground.controller";

const router = Router();

router.post("/run", runPlayground);

export const playgroundRouter = router;
