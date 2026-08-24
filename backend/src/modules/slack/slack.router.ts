import { Router } from "express";
import { slackEventsPost, slackInteractivePost } from "./controllers";

const router = Router();

router.post("/events", slackEventsPost);
router.post("/interactive", slackInteractivePost);

export default router;
