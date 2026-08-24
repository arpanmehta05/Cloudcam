#!/usr/bin/env node

const apiBaseUrl = (process.env.API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const agentId = process.env.VPS_AGENT_ID;
const ingestKey = process.env.VPS_INGEST_KEY;
const source = process.env.VPS_LOG_SOURCE || "pm2";
const service = process.env.VPS_LOG_SERVICE || "mail-alert-test";
const count = Number.parseInt(process.env.VPS_TEST_ERROR_COUNT || "3", 10);

function usage() {
    console.error(`
Usage:
  $env:API_BASE_URL="http://localhost:4000"
  $env:VPS_AGENT_ID="agt_xxxxx"
  $env:VPS_INGEST_KEY="rbt_xxxxx"
  node backend/scripts/test-vps-log-alert-mail.js

Optional:
  $env:VPS_TEST_ERROR_COUNT="3"
  $env:VPS_LOG_SOURCE="pm2"
  $env:VPS_LOG_SERVICE="mail-alert-test"
`);
}

function randomToken(length = 12) {
    const alphabet = "ghijkmnopqrstuvwxyz";
    let value = "";
    for (let i = 0; i < length; i += 1) {
        value += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return value;
}

async function main() {
    if (!agentId || !ingestKey) {
        usage();
        process.exit(1);
    }

    if (!Number.isFinite(count) || count < 1) {
        throw new Error("VPS_TEST_ERROR_COUNT must be a positive number");
    }

    const token = randomToken();
    const errorLine = `ERROR VPS_MAIL_ALERT_TEST_${token} simulated repeated database connection failure`;
    const logs = Array.from({ length: count }, () => errorLine).join("\n");
    const logsBase64 = Buffer.from(logs, "utf8").toString("base64");

    const response = await fetch(`${apiBaseUrl}/api/vps-logs/ingest`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-agent-id": agentId,
            "x-ingest-key": ingestKey,
        },
        body: JSON.stringify({
            agentId,
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

    console.log("VPS alert mail test result");
    console.log("--------------------------");
    console.log(`API: ${apiBaseUrl}/api/vps-logs/ingest`);
    console.log(`Agent: ${agentId}`);
    console.log(`Service: ${service}`);
    console.log(`Source: ${source}`);
    console.log(`Sent repeated errors: ${count}`);
    console.log(`Unique signature token: ${token}`);
    console.log(`HTTP status: ${response.status}`);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (!response.ok || data?.success === false) {
        process.exit(1);
    }

    console.log("");
    console.log("If SMTP is configured and the agent belongs to a user with an email, the alert email should arrive for that account holder.");
    console.log("Run this script again any time; it uses a new signature token to avoid the alert cooldown.");
}

main().catch((error) => {
    console.error("VPS alert mail test failed:", error);
    process.exit(1);
});
