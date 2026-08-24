import { Router } from "express";
import { authMiddleware, requireRole } from "../auth";
import { FEATURE_KEYS, requireFeature } from "../admin";
import {
  vpsLogIngestPost,
  vpsLogAlertMailTestPost,
  vpsAgentsGet,
  createVpsAgentPost,
  vpsAgentConfigPatch,
  vpsAgentDelete,
  vpsLogSummaryGet,
  vpsLogsClearRecentDelete,
  vpsAlarmRulesGet,
  vpsAlarmRulesPost,
  vpsAlarmRulePatch,
  vpsAlarmRuleDelete,
  vpsLogAlertPolicyPost,
} from "./controllers";

const router = Router();

// Public routes
router.post("/ingest", vpsLogIngestPost);
router.post("/test-alert-mail", vpsLogAlertMailTestPost);

// Protected routes (require authMiddleware)
router.use(authMiddleware);
router.use(requireFeature(FEATURE_KEYS.vpsLogs));

router.get("/agents", vpsAgentsGet);
router.post("/agents", requireRole(["admin"]), createVpsAgentPost);
router.patch("/agents/:agentId", requireRole(["admin"]), vpsAgentConfigPatch);
router.delete("/agents", requireRole(["admin"]), vpsAgentDelete);
router.get("/summary", vpsLogSummaryGet);
router.delete("/recent", requireRole(["admin"]), vpsLogsClearRecentDelete);
router.get("/alarms", vpsAlarmRulesGet);
router.post("/alarms", requireRole(["admin"]), vpsAlarmRulesPost);
router.patch("/alarms/:id", requireRole(["admin"]), vpsAlarmRulePatch);
router.delete("/alarms/:id", requireRole(["admin"]), vpsAlarmRuleDelete);
router.post("/alert-policy", requireRole(["admin"]), vpsLogAlertPolicyPost);

export default router;
