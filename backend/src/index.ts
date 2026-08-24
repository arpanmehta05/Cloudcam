// Express Backend Entrypoint - Trigger reload 4
import dns from "node:dns";
// Override local DNS to fix MongoDB querySrv ECONNREFUSED errors
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import path from "path";
import express from "express";
import cors from "cors";
import { config, validateConfig } from "./core/config";
import { connectDatabase } from "./core/database";
import { logger } from "./core/logger";
import apiRoutes from "./routes/index";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/logger";
import { seedMigrationErrorPatterns } from "./services/resize-migration/error-kb.service";

// Validate env configuration on startup
validateConfig();

// ─── Global error handlers — prevent process crashes on unhandled errors ───
process.on("unhandledRejection", (reason: any) => {
    logger.error("[FATAL] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
    logger.error("[FATAL] Uncaught Exception:", error);
    if ((error as NodeJS.ErrnoException)?.code === "EADDRINUSE") {
        logger.error(`[FATAL] Port ${config.port} is already in use. Stop the existing backend process before starting another one.`);
        process.exit(1);
    }
    // Don't exit for unrelated request-path errors — keep the server alive for other requests
});

const app = express();

// Middleware
app.use((req, res, next) => {
    if (req.path === "/api/azure/template") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Cache-Control", "public, max-age=300");
        if (req.method === "OPTIONS") return res.sendStatus(204);
    }
    next();
});
app.use(cors({ origin: config.corsOrigin, credentials: true }));

// Disable browser caching for dynamic API responses by default
app.use("/api", (req, res, next) => {
    if (req.path !== "/azure/template") {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }
    next();
});

const jsonParser = express.json({
    limit: "1mb",
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
});
const urlencodedParser = express.urlencoded({
    extended: true,
    limit: "1mb",
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
});
const textParser = express.text({ type: "*/*", limit: "6mb" });

app.use((req, res, next) => {
    if (req.path === "/api/vps-logs/ingest") {
        return textParser(req, res, next);
    }
    if (req.path === "/api/integrations/slack/interactive") {
        return urlencodedParser(req, res, next);
    }
    return jsonParser(req, res, next);
});
app.use(requestLogger);

// Request timeout middleware — prevent proxy hang-ups on long AWS calls
app.use((req, res, next) => {
    const timeoutMs = config.requestTimeoutMs;
    req.setTimeout(timeoutMs);
    res.setTimeout(timeoutMs, () => {
        const seconds = Math.round(timeoutMs / 1000);
        logger.error(`[Timeout] ${req.method} ${req.path} exceeded ${seconds}s`);
        if (!res.headersSent) {
            res.status(504).json({ success: false, error: "Request timed out" });
        }
    });
    next();
});

// Routes
app.use("/api", apiRoutes);
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
});

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Error handler (must be last)
app.use(errorHandler);

import { startAiObservabilityCron } from "./jobs/ai-observability.cron";

// Start server
async function start() {
    await connectDatabase();
    await seedMigrationErrorPatterns();

    // Start AI Observability cron jobs
    startAiObservabilityCron();

    // Background Docker image pre-compilation check
    import("./services/container-manager").then(async ({ isFargateMode, isDockerAvailable, ensureImage, buildImage }) => {
        if (!isFargateMode()) {
            try {
                const available = await isDockerAvailable();
                if (available) {
                    const ready = await ensureImage();
                    if (!ready) {
                        logger.info("[Startup] Docker images are missing. Starting background build...");
                        const backendDir = path.join(__dirname, "../");
                        buildImage(backendDir)
                            .then(() => logger.info("[Startup] Background Docker image build completed successfully."))
                            .catch(err => logger.error("[Startup] Background Docker image build failed:", err));
                    } else {
                        logger.info("[Startup] Docker runner images are ready.");
                    }
                } else {
                    logger.warn("[Startup] Docker daemon is not available. Local deployments will be disabled until Docker is started.");
                }
            } catch (err) {
                logger.error("[Startup] Failed during Docker check:", err);
            }
        }
    }).catch(err => {
        logger.error("[Startup] Failed to load container manager for background build check:", err);
    });

    // Start checking scheduled migration jobs every 15 seconds
    import("./services/resize-migration/job.service").then(({ checkAndRunScheduledJobs }) => {
        setInterval(checkAndRunScheduledJobs, 15000);
        logger.info("[Scheduled Jobs Scheduler] Periodic check started (every 15s).");
    }).catch(err => {
        logger.error("[Scheduled Jobs Scheduler] Failed to start:", err);
    });

    const server = app.listen(config.port, () => {
        logger.info(`\n🐰 Rabbittize Backend running on http://localhost:${config.port}`);
        logger.info(`   CORS: ${config.corsOrigin}`);
        logger.info(`   Gemini: ${config.geminiApiKey ? "✅ configured" : "❌ not configured"}`);
        logger.info(`   AWS Region: ${config.aws.region}\n`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
            logger.error(`[FATAL] Port ${config.port} is already in use. Stop the existing backend process before starting another one.`);
            process.exit(1);
        }
        throw error;
    });

    // Keep-alive and header timeouts to prevent premature socket closes on long AWS calls
    server.keepAliveTimeout = 120_000;
    server.headersTimeout = 180_000;
}

start();
