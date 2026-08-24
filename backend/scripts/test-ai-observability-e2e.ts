import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import axios from "axios";
import jwt from "jsonwebtoken";
import { User } from "../src/models/user.model";
import { config } from "../src/config/env";
import { AiRequestLog } from "../src/models/ai-request-log.model";
import { AiDailyMetric } from "../src/models/ai-daily-metric.model";
import { AiIngestKey } from "../src/models/ai-ingest-key.model";

const BASE_URL = "http://localhost:4000";

async function run() {
    console.log("=========================================");
    console.log("🧪 AI Observability E2E Test Script");
    console.log("=========================================\n");

    // 1. Connect to database
    console.log("Connecting to MongoDB...");
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    try {
        // 2. Setup/Find Test User
        let user = await User.findOne({ email: "test-session-user@rabbittize.com" });
        if (!user) {
            console.log("Creating test user (test-session-user@rabbittize.com)...");
            user = await User.create({
                email: "test-session-user@rabbittize.com",
                name: "Test User",
                passwordHash: "$2a$10$Xm1UeXFw6z/63D1WlhfR5uI17zN7.xW.v36n.dF6B.k5C1z2Fz2Fu", // bcrypt hash for 'password'
                permissionLevel: "admin",
                awsCredentials: {
                    connectedAt: new Date()
                }
            });
        }
        const userId = user._id.toString();
        console.log(`User: ${user.email} (ID: ${userId})`);

        // 3. Clear old AI test data so we have a clean test run
        console.log("Clearing old AI telemetry logs for this test user...");
        await AiRequestLog.deleteMany({ userId });
        await AiDailyMetric.deleteMany({ userId });
        await AiIngestKey.deleteMany({ userId });

        // 4. Generate Web User JWT
        const token = jwt.sign(
            { userId, email: user.email, permissionLevel: user.permissionLevel || "admin" },
            config.jwtSecret,
            { expiresIn: "1h" }
        );
        const headers = { Authorization: `Bearer ${token}` };

        // 5. Test if local server is running
        try {
            await axios.get(`${BASE_URL}/health`);
        } catch (err) {
            console.error(`\n❌ Error: Local server is not running on ${BASE_URL}.`);
            console.error("Please start the backend server in another terminal window first:");
            console.error("   cd backend && npm run dev\n");
            process.exit(1);
        }

        // 6. Generate Ingest Key via API
        console.log("\nGenerating Ingestion API Key...");
        const keyResponse = await axios.post(
            `${BASE_URL}/api/ai-observability/ingest-keys`,
            { name: "Test Ingestion Key", scopes: ["events:write", "traces:write"] },
            { headers }
        );

        const ingestToken = keyResponse.data.token;
        console.log(`✅ API Ingestion Key Generated: ${ingestToken.substring(0, 15)}...`);

        // 7. Post Telemetry Events using Ingest Key
        console.log("\nSimulating LLM request events...");
        const events = [
            // Event 1: Premium Model with heavy prompt (triggers compression/routing recommendation)
            {
                provider: "openai",
                model: "gpt-4-turbo",
                requestId: `req_${Date.now()}_1`,
                promptTokens: 2500,
                completionTokens: 100,
                totalTokens: 2600,
                latencyMs: 1250,
                cost: 0.078, // High cost
                status: "success",
                serviceName: "chat-service",
                endpoint: "/chat/v1",
                inputPreview: "Heavy prompt with repeating system parameters...",
                outputPreview: "OK"
            },
            // Event 2: Repeating similar event (triggers routing recommendation)
            {
                provider: "openai",
                model: "gpt-4-turbo",
                requestId: `req_${Date.now()}_2`,
                promptTokens: 2450,
                completionTokens: 95,
                totalTokens: 2545,
                latencyMs: 1100,
                cost: 0.076,
                status: "success",
                serviceName: "chat-service",
                endpoint: "/chat/v1",
                inputPreview: "Heavy prompt with repeating system parameters...",
                outputPreview: "OK"
            },
            // Event 3: Bedrock heavy prompt (triggers Bedrock routing suggestions)
            {
                provider: "bedrock",
                model: "anthropic.claude-v3-sonnet",
                requestId: `req_${Date.now()}_3`,
                promptTokens: 1800,
                completionTokens: 80,
                totalTokens: 1880,
                latencyMs: 980,
                cost: 0.057,
                status: "success",
                serviceName: "summary-service",
                endpoint: "/summary/v1",
                inputPreview: "Long text to summarize...",
                outputPreview: "Summary content"
            },
            // Event 4: Gemini Flash lightweight call (normal profile)
            {
                provider: "gemini",
                model: "gemini-2.5-flash",
                requestId: `req_${Date.now()}_4`,
                promptTokens: 150,
                completionTokens: 250,
                totalTokens: 400,
                latencyMs: 450,
                cost: 0.0001,
                status: "success",
                serviceName: "translation-service",
                endpoint: "/translate",
                inputPreview: "Short text",
                outputPreview: "Translation"
            },
            // Event 5: Failed request (status: error)
            {
                provider: "openai",
                model: "gpt-4-turbo",
                requestId: `req_${Date.now()}_5`,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                latencyMs: 150,
                cost: 0,
                status: "error",
                errorMessage: "API Connection Timeout",
                serviceName: "chat-service",
                endpoint: "/chat/v1"
            },
            // Event 6: Rate limited request
            {
                provider: "openai",
                model: "gpt-4-turbo",
                requestId: `req_${Date.now()}_6`,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                latencyMs: 50,
                cost: 0,
                status: "rate_limited",
                errorMessage: "429 Too Many Requests",
                serviceName: "chat-service",
                endpoint: "/chat/v1"
            }
        ];

        // Send events to backend events endpoint using ingest key header
        const ingestHeaders = { "x-rabbittize-ingest-key": ingestToken };
        for (const event of events) {
            console.log(`  Posting event: [${event.provider}/${event.model}] -> status: ${event.status}`);
            await axios.post(`${BASE_URL}/api/ai-observability/events`, event, { headers: ingestHeaders });
        }
        console.log("✅ Ingest Simulation Complete.");

        // 8. Run Anomaly / Alerts Evaluation
        console.log("\nEvaluating Alert Rules...");
        const evalResponse = await axios.post(`${BASE_URL}/api/ai-observability/alerts/evaluate`, {}, { headers });
        console.log(`✅ Alert evaluation finished. Created: ${evalResponse.data.createdCount} alerts.`);

        // 9. Fetch and Verify Observability Dashboard Metrics
        console.log("\n=========================================");
        console.log("📊 Fetching Ingested Analytics Details");
        console.log("=========================================");

        // Fetch Overview
        const overview = await axios.get(`${BASE_URL}/api/ai-observability/overview?range=24h`, { headers });
        console.log("\n📈 Overview Dashboard:");
        console.log(JSON.stringify(overview.data.overview, null, 2));

        // Fetch Cost trends
        const costs = await axios.get(`${BASE_URL}/api/ai-observability/costs?range=24h`, { headers });
        console.log("\n💰 Cost & Provider Breakdown:");
        console.log(`  Total Spend Today: $${costs.data.totalSpend}`);
        console.log(`  Top Provider: ${costs.data.mostExpensiveProvider}`);
        console.log(`  Top Model: ${costs.data.mostExpensiveModel}`);

        // Fetch Errors
        const errors = await axios.get(`${BASE_URL}/api/ai-observability/errors?range=24h`, { headers });
        console.log(`\n❌ Error Log Feed (Total: ${errors.data.errors?.length || 0}):`);
        errors.data.errors?.forEach((e: any) => {
            console.log(`  - [${e.status}] ${e.provider}/${e.modelName}: "${e.errorMessage || 'N/A'}"`);
        });

        // Fetch Routing Recommendations
        const routing = await axios.get(`${BASE_URL}/api/ai-observability/recommendations/routing?rangeDays=1`, { headers });
        console.log(`\n🔄 Routing Optimization Recommendations (Total: ${routing.data.recommendations?.length || 0}):`);
        routing.data.recommendations?.forEach((r: any) => {
            console.log(`  - Swap ${r.currentModel} ➡️ ${r.suggestedModel} on ${r.endpoint}`);
            console.log(`    Savings: $${r.monthlySavings}/mo | Confidence: ${r.confidence * 100}%`);
            console.log(`    Rule Triggered: "${r.ruleTriggered}"`);
        });

        // Fetch Prompt Compression Insights
        const prompts = await axios.get(`${BASE_URL}/api/ai-observability/recommendations/prompts?rangeDays=1`, { headers });
        console.log(`\n📝 Prompt Optimization Insights (Total: ${prompts.data.insights?.length || 0}):`);
        prompts.data.insights?.forEach((p: any) => {
            console.log(`  - Endpoint: ${p.endpoint} (${p.insightType})`);
            console.log(`    Message: "${p.message}"`);
            console.log(`    Savings: $${p.estimatedCostSavings}/mo`);
        });

        console.log("\n=========================================");
        console.log("🎉 E2E Test Completed Successfully!");
        console.log("=========================================");

    } catch (err: any) {
        console.error("\n❌ E2E Test Failed with error:", err.response?.status, JSON.stringify(err.response?.data || err.message, null, 2));
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB.");
    }
}

run();
