import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { User } from "../src/models/user.model";
import { AiIngestKey } from "../src/models/ai-ingest-key.model";
import { AiRequestLog } from "../src/models/ai-request-log.model";
import { AiTrace } from "../src/models/ai-trace.model";
import { AiTraceSpan } from "../src/models/ai-trace-span.model";
import { createIngestKey } from "../src/services/ai-ingest-key.service";

const BASE_URL = "http://localhost:4000";

async function run() {
    console.log("=========================================");
    console.log("🧪 testing Bifrost LLM Gateway");
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
                passwordHash: "$2a$10$Xm1UeXFw6z/63D1WlhfR5uI17zN7.xW.v36n.dF6B.k5C1z2Fz2Fu", // password
                permissionLevel: "admin",
                awsCredentials: {
                    connectedAt: new Date()
                }
            });
        }
        const userId = user._id.toString();

        // 3. Setup/Find Ingest Key
        let ingestKey = await AiIngestKey.findOne({ userId, revokedAt: null });
        let ingestToken = "";
        if (!ingestKey) {
            console.log("Generating Ingestion API Key...");
            const keyRes = await createIngestKey(userId, { name: "Bifrost Test Key", scopes: ["events:write", "traces:write"] });
            ingestToken = keyRes.token;
        } else {
            // Since we hash keys, let's create a fresh key to ensure we have the raw token text
            console.log("Generating fresh Ingestion API Key...");
            const keyRes = await createIngestKey(userId, { name: "Bifrost Test Key", scopes: ["events:write", "traces:write"] });
            ingestToken = keyRes.token;
        }
        console.log(`✅ API Ingestion Key: ${ingestToken}`);

        // 4. Test if local server is running
        try {
            await axios.get(`${BASE_URL}/health`);
        } catch (err) {
            console.error(`\n❌ Error: Local server is not running on ${BASE_URL}.`);
            console.error("Please start the backend server in another terminal window first:");
            console.error("   cd backend && npm run dev\n");
            process.exit(1);
        }

        // 5. Test Non-Streaming Call
        console.log("\n1. Testing Non-Streaming Chat Completion through Bifrost Gateway...");
        const payload = {
            model: "gemini-2.5-flash",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Say 'Bifrost Gateway online!' and nothing else." }
            ],
            stream: false
        };

        const headers = {
            "Authorization": `Bearer ${ingestToken}`,
            "x-rabbittize-environment": "staging",
            "x-rabbittize-service-name": "bifrost-test-runner",
            "x-rabbittize-endpoint": "/api/test",
            "x-rabbittize-trace-id": "trace-test-123",
        };

        const response = await axios.post(`${BASE_URL}/api/bifrost/v1/chat/completions`, payload, { headers });
        console.log("✅ Response Status:", response.status);
        console.log("✅ Response Data:", JSON.stringify(response.data, null, 2));

        // 6. Test Streaming Call
        console.log("\n2. Testing Streaming Chat Completion through Bifrost Gateway...");
        const streamPayload = {
            model: "gemini-2.5-flash",
            messages: [
                { role: "user", content: "Count from 1 to 3." }
            ],
            stream: true
        };

        const streamResponse = await axios.post(`${BASE_URL}/api/bifrost/v1/chat/completions`, streamPayload, {
            headers,
            responseType: "stream"
        });

        console.log("✅ Stream response status:", streamResponse.status);
        streamResponse.data.on("data", (chunk: Buffer) => {
            const lines = chunk.toString().split("\n");
            for (const line of lines) {
                if (line.trim().startsWith("data: ")) {
                    console.log("  Stream Chunk:", line.trim());
                }
            }
        });

        streamResponse.data.on("end", async () => {
            console.log("\n✅ Stream Completed.");

            // Wait 2 seconds for async logging db write to finish
            console.log("\nWaiting for database records to persist...");
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify db logging
            const logs = await AiRequestLog.find({ userId }).sort({ createdAt: -1 }).limit(2).lean();
            console.log(`\n📊 Verified Database Request Logs (Found: ${logs.length}):`);
            logs.forEach(log => {
                console.log(`  - [${log.status}] Model: ${log.modelName} | Provider: ${log.provider} | Latency: ${log.latencyMs}ms | Cost: $${log.cost}`);
                console.log(`    Input Preview: "${log.inputPreview}"`);
                console.log(`    Output Preview: "${log.outputPreview}"`);
                console.log(`    TraceID: "${log.traceId}" | Service: "${log.serviceName}"`);
            });

            const trace = await AiTrace.findOne({ userId, traceId: headers["x-rabbittize-trace-id"] }).lean();
            const spans = await AiTraceSpan.find({ userId, traceId: headers["x-rabbittize-trace-id"] }).lean();
            const linkedLogs = await AiRequestLog.find({ userId, traceId: headers["x-rabbittize-trace-id"] }).lean();

            if (!trace || spans.length < 2 || linkedLogs.length < 2) {
                throw new Error(
                    `Trace persistence failed: trace=${Boolean(trace)}, spans=${spans.length}, linkedLogs=${linkedLogs.length}`
                );
            }

            console.log(`\nVerified Trace Explorer artifacts: 1 trace, ${spans.length} spans, ${linkedLogs.length} linked request logs.`);

            console.log("\n=========================================");
            console.log("🎉 Bifrost Gateway Test Completed Successfully!");
            console.log("=========================================");
            mongoose.disconnect();
        });

    } catch (err: any) {
        console.error("\n❌ Test Failed with error:", err.response?.status, JSON.stringify(err.response?.data || err.message, null, 2));
        mongoose.disconnect();
    }
}

run();
