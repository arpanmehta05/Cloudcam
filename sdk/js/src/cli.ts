#!/usr/bin/env node
import fs from "fs";

const version = "0.1.7";

const DEFAULT_ENDPOINT = "https://rabbitize-api.rabbitt.ai";

function env(name: string): string | undefined {
    return process.env[name];
}

function config() {
    const apiKey = env("RABBITTWATCH_API_KEY") || env("RABBITWATCH_INGEST_KEY") || "";
    const endpoint = (env("RABBITTWATCH_ENDPOINT") || DEFAULT_ENDPOINT).replace(/\/$/, "");
    return { apiKey, endpoint };
}

async function apiFetch(path: string, init?: RequestInit) {
    const { apiKey, endpoint } = config();
    const response = await fetch(`${endpoint}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            "X-Rabbittize-Ingest-Key": apiKey,
            ...(init?.headers || {}),
        },
    });
    return response;
}

function printHelp() {
    console.log("RabbittWatch AI Observability CLI");
    console.log("Usage: ai-observability <command> [options]");
    console.log("");
    console.log("Commands:");
    console.log("  doctor                 Check configuration and connectivity");
    console.log("  send-test-trace        Send a sample trace to verify ingestion");
    console.log("  prompt pull <name>     Resolve and print a prompt version");
    console.log("  prompt diff <name>     Show the resolved prompt template");
    console.log("  export traces          Export recent traces as JSON");
    console.log("  -v, --version          Output the version number");
    console.log("  -h, --help             Output usage information");
    console.log("");
    console.log("Environment:");
    console.log("  RABBITTWATCH_API_KEY   Ingest key (required)");
    console.log("  RABBITTWATCH_ENDPOINT  API base URL (default: " + DEFAULT_ENDPOINT + ")");
}

async function doctor() {
    const { apiKey, endpoint } = config();
    console.log(`Endpoint: ${endpoint}`);
    console.log(`API key:  ${apiKey ? `${apiKey.slice(0, 6)}… (set)` : "MISSING — set RABBITTWATCH_API_KEY"}`);
    if (!apiKey) {
        process.exitCode = 1;
        return;
    }
    try {
        const response = await apiFetch("/api/ai-observability/traces?limit=1");
        console.log(`Connectivity: ${response.ok ? "OK" : `HTTP ${response.status}`}`);
        process.exitCode = response.ok ? 0 : 1;
    } catch (error) {
        console.log(`Connectivity: FAILED (${error instanceof Error ? error.message : String(error)})`);
        process.exitCode = 1;
    }
}

async function sendTestTrace() {
    const traceId = `trace_cli_${Date.now().toString(36)}`;
    const now = new Date();
    const envelope = {
        trace: {
            traceId,
            name: "cli.test-trace",
            serviceName: "rabbittwatch-cli",
            environment: "dev",
            startedAt: now.toISOString(),
            endedAt: new Date(now.getTime() + 120).toISOString(),
        },
        spans: [
            {
                spanId: `span_cli_${Date.now().toString(36)}`,
                name: "cli.test-span",
                kind: "llm",
                provider: "openai",
                model: "gpt-4o-mini",
                status: "success",
                startedAt: now.toISOString(),
                endedAt: new Date(now.getTime() + 120).toISOString(),
                durationMs: 120,
                promptTokens: 10,
                completionTokens: 5,
                totalTokens: 15,
            },
        ],
    };
    const response = await apiFetch("/api/ai-observability/traces", {
        method: "POST",
        body: JSON.stringify(envelope),
    });
    if (response.ok) {
        console.log(`Sent test trace ${traceId}`);
    } else {
        console.error(`Failed to send test trace: HTTP ${response.status}`);
        process.exitCode = 1;
    }
}

async function promptPull(name: string, showTemplate: boolean) {
    if (!name) {
        console.error("Usage: ai-observability prompt pull <name>");
        process.exitCode = 1;
        return;
    }
    const response = await apiFetch(`/api/prompts/registry/${encodeURIComponent(name)}/resolve`);
    if (!response.ok) {
        console.error(`Failed to resolve prompt: HTTP ${response.status}`);
        process.exitCode = 1;
        return;
    }
    const body = await response.json();
    const data = body?.data || body;
    const versionInfo = data.version || {};
    if (showTemplate) {
        console.log(versionInfo.template || "(no template)");
    } else {
        console.log(JSON.stringify({ version: versionInfo.version, state: versionInfo.state, environment: versionInfo.environment, contentHash: versionInfo.contentHash }, null, 2));
    }
}

async function exportTraces() {
    const response = await apiFetch("/api/ai-observability/traces?limit=100");
    if (!response.ok) {
        console.error(`Failed to export traces: HTTP ${response.status}`);
        process.exitCode = 1;
        return;
    }
    const body = await response.json();
    console.log(JSON.stringify(body?.data || body, null, 2));
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes("--version") || args.includes("-v") || args[0] === "version") {
        console.log(version);
        return;
    }
    if (args.includes("--which") || args[0] === "which") {
        try {
            console.log(fs.realpathSync(process.argv[1] || __filename));
        } catch {
            console.log(__filename);
        }
        return;
    }
    if (args.length === 0 || args.includes("--help") || args.includes("-h") || args[0] === "help") {
        printHelp();
        return;
    }

    const [command, sub, arg] = args;
    switch (command) {
        case "doctor":
            await doctor();
            break;
        case "send-test-trace":
            await sendTestTrace();
            break;
        case "prompt":
            if (sub === "pull") await promptPull(arg, false);
            else if (sub === "diff") await promptPull(arg, true);
            else console.error("Usage: ai-observability prompt <pull|diff> <name>");
            break;
        case "export":
            if (sub === "traces") await exportTraces();
            else console.error("Usage: ai-observability export traces");
            break;
        default:
            console.error(`Unknown command: ${command}`);
            printHelp();
            process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
