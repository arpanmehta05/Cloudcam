import { Router } from "express";
import {
  getNotificationSettingsHandler,
  putNotificationSettingsHandler,
  testSlackNotificationHandler,
} from "./controllers";

const router = Router();

router.get("/", getNotificationSettingsHandler);
router.put("/", putNotificationSettingsHandler);
router.post("/slack/test", testSlackNotificationHandler);

export default router;
