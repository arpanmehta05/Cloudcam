#!/usr/bin/env node

require("dotenv").config();

const crypto = require("crypto");
const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const apiBaseUrl = (process.env.API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const sourceAgentId = process.env.VPS_AGENT_ID;
const source = process.env.VPS_LOG_SOURCE || "pm2";
const service = process.env.VPS_LOG_SERVICE || "mail-alert-test";
const count = Number.parseInt(process.env.VPS_TEST_ERROR_COUNT || "3", 10);
const mongodbUri = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";

const vpsLogAgentSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true, trim: true },
        vpcId: { type: String, default: "" },
        environment: { type: String, default: "" },
        agentId: { type: String, required: true, unique: true, index: true },
        ingestKeyHash: { type: String, required: true },
        lastSeenAt: { type: Date },
        metadata: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
);

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true },
        name: { type: String, required: true },
        passwordHash: { type: String, required: true },
    },
    { timestamps: true, strict: false }
);

const VpsLogAgent = mongoose.model("VpsLogAgent", vpsLogAgentSchema);
const User = mongoose.model("User", userSchema);

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken(length = 12) {
    return crypto.randomBytes(length).toString("hex").slice(0, length);
}

function usage() {
    console.error(`
Usage:
  $env:VPS_AGENT_ID="agt_existing_agent_id"
  node backend/scripts/run-vps-alert-mail-test.js

Optional:
  $env:API_BASE_URL="http://localhost:4000"
  $env:VPS_TEST_ERROR_COUNT="3"
`);
}

async function main() {
    if (!sourceAgentId) {
        usage();
        process.exit(1);
    }
    if (!Number.isFinite(count) || count < 1) {
        throw new Error("VPS_TEST_ERROR_COUNT must be a positive number");
    }

    await mongoose.connect(mongodbUri);

    const sourceAgent = await VpsLogAgent.findOne({ agentId: sourceAgentId }).lean();
    if (!sourceAgent) {
        throw new Error(`Could not find source agent ${sourceAgentId} in MongoDB`);
    }

    const user = await User.findById(sourceAgent.userId).lean();
    if (!user?.email) {
        throw new Error(`Could not find account holder email for user ${sourceAgent.userId}`);
    }

    const testAgentId = `agt_mailtest_${randomToken(10)}`;
    const rawIngestKey = `rbt_mailtest_${randomToken(24)}`;
    const signatureToken = randomToken(12);

    await VpsLogAgent.create({
        userId: sourceAgent.userId,
        name: "Mail Alert Test Agent",
        vpcId: sourceAgent.vpcId || "test",
        environment: "test",
        agentId: testAgentId,
        ingestKeyHash: sha256(rawIngestKey),
        metadata: {
            createdBy: "run-vps-alert-mail-test.js",
            sourceAgentId,
        },
    });

    const errorLine = `ERROR VPS_MAIL_ALERT_TEST_${signatureToken} simulated repeated database connection failure`;
    const logsBase64 = Buffer.from(Array.from({ length: count }, () => errorLine).join("\n"), "utf8").toString("base64");

    const response = await fetch(`${apiBaseUrl}/api/vps-logs/ingest`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-agent-id": testAgentId,
            "x-ingest-key": rawIngestKey,
        },
        body: JSON.stringify({
            agentId: testAgentId,
            source,
            service,
            logsBase64,
            timestamp: new Date().toISOString(),
        }),
    });

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    console.log("VPS alert mail live test result");
    console.log("--------------------------------");
    console.log(`Account holder: ${user.email}`);
    console.log(`Source agent: ${sourceAgentId}`);
    console.log(`Temporary test agent: ${testAgentId}`);
    console.log(`Sent repeated errors: ${count}`);
    console.log(`Unique signature token: ${signatureToken}`);
    console.log(`HTTP status: ${response.status}`);
    console.log("Response:", JSON.stringify(data, null, 2));

    await mongoose.disconnect();

    if (!response.ok || data?.success === false) {
        process.exit(1);
    }

    console.log("");
    console.log("If SMTP is configured correctly, the account holder above should receive the VPS error burst email.");
}

main().catch(async (error) => {
    console.error("VPS alert mail live test failed:", error);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect failures
    }
    process.exit(1);
});
