import { Router } from "express";
import { authMiddleware } from "../auth";
import { FEATURE_KEYS, requireFeature } from "../admin";
import { scoresRouter } from "./scores/scores.router";
import { pricingRouter } from "./pricing/pricing.router";
import { setupRouter } from "./setup/setup.router";
import { overviewRouter } from "./overview/overview.router";
import { tracesRouter } from "./traces/traces.router";
import { traceDetailRouter } from "./trace-detail/trace-detail.router";
import { annotationsRouter } from "./annotations/annotations.router";
import { modelUsageRouter } from "./model-usage/model-usage.router";
import { feedbackRouter } from "./feedback/feedback.router";
import { costTokensRouter } from "./cost-tokens/cost-tokens.router";
import { errorsRouter } from "./errors/errors.router";
import { alertsRouter } from "./alerts/alerts.router";
import { routingRecommendationsRouter } from "./routing-recommendations/routing-recommendations.router";
import { promptInsightsRouter } from "./prompt-insights/prompt-insights.router";
import sessionsRouter from "./sessions/sessions.router";
import usersRouter from "./users/users.router";
import { analyticsRouter } from "./analytics/analytics.router";
import { bedrockRouter } from "./bedrock/bedrock.router";
import { budgetRouter } from "./budget/budget.router";
import { ingestProtectedRouter, ingestPublicRouter } from "./ingest/ingest.router";
import { observationsRouter } from "./observations/observations.router";
import { savedViewsRouter } from "./saved-views/saved-views.router";
import { webhooksRouter } from "./webhooks/webhooks.router";
import { openapiRouter } from "./openapi/openapi.router";
import { publicSharedReportsRouter, sharedReportsRouter } from "./shared-reports/shared-reports.router";

const router = Router();

router.use(ingestPublicRouter);

router.use(openapiRouter);
router.use(publicSharedReportsRouter);

router.use(authMiddleware);
// Ingest keys authenticate external integrations, including Agent Watcher.
// Signed-in users can manage their own keys even when the wider AI
// Observability product remains plan-gated.
router.use(setupRouter);
router.use(requireFeature(FEATURE_KEYS.aiObservability));

router.use(overviewRouter);
router.use(costTokensRouter);
router.use(modelUsageRouter);
router.use(errorsRouter);
router.use(alertsRouter);
router.use(routingRecommendationsRouter);
router.use(promptInsightsRouter);
router.use(budgetRouter);
router.use(webhooksRouter);
router.use(feedbackRouter);
router.use(annotationsRouter);
router.use(sharedReportsRouter);

router.use(sessionsRouter);
router.use(usersRouter);
router.use(scoresRouter);
router.use(pricingRouter);
router.use(savedViewsRouter);
router.use(observationsRouter);
router.use(tracesRouter);
router.use(traceDetailRouter);
router.use(ingestProtectedRouter);
router.use(analyticsRouter);
router.use(bedrockRouter);

export default router;
