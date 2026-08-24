import { RabbittWatchAI } from "../dist/index.js";
import assert from "assert";

console.log("=== Testing RabbittWatch JS SDK Upgraded Features ===");

const redactPatterns = [/custom-secret-\d+/g];
const customRedactFn = (text) => text.replace(/scrub-me/g, "[scrubbed]");

const rw = new RabbittWatchAI({
    apiKey: "rw_live_test_api_key_12345",
    endpoint: "http://localhost:4000",
    captureInput: true,
    captureOutput: true,
    redactPatterns,
    customRedactFn,
    flushIntervalMs: 0, // Manual flush
});

// 1. Verify custom plugin registration and execution
const pluginEvents = [];
const testPlugin = {
    name: "TestPlugin",
    onTraceStart(trace, options) {
        pluginEvents.push({ event: "onTraceStart", traceId: trace.traceId, name: options.name });
    },
    onTraceEnd(trace) {
        pluginEvents.push({ event: "onTraceEnd", traceId: trace.traceId });
    },
    onSpanStart(span, options) {
        pluginEvents.push({ event: "onSpanStart", spanId: span.spanId, name: options.name });
    },
    onSpanEnd(span, options) {
        pluginEvents.push({ event: "onSpanEnd", spanId: span.spanId });
    },
    onFlush(envelope) {
        pluginEvents.push({ event: "onFlush", traceId: envelope.trace.traceId, spanCount: envelope.spans.length });
    }
};

rw.use(testPlugin);

// 2. Run a traced function containing sensitive data (deep nesting)
const nestedInput = {
    messages: [
        { role: "user", content: "Tell me a joke about security" }
    ],
    config: {
        api_key: "super-secret-key-to-hide",
        nested: {
            password: "my-secure-password",
            customToken: "custom-secret-9999",
            flag: "scrub-me-please"
        }
    }
};

const result = await rw.trace(
    {
        name: "test.redaction.flow",
        input: nestedInput,
        metadata: { sessionId: "session_opencode_12345" }
    },
    async () => {
        return {
            output: "Here is your joke!",
            usage: { prompt_tokens: 10, completion_tokens: 5 },
            response: {
                authorization: "Bearer secret-auth-token-to-mask"
            }
        };
    }
);

console.log("Trace executed successfully.");

// Flush client
await rw.flush();

// Verify plugin events
console.log("Recorded Plugin Events:", pluginEvents);
assert.ok(pluginEvents.some(e => e.event === "onTraceStart"), "onTraceStart not triggered");
assert.ok(pluginEvents.some(e => e.event === "onSpanStart"), "onSpanStart not triggered");
assert.ok(pluginEvents.some(e => e.event === "onSpanEnd"), "onSpanEnd not triggered");
assert.ok(pluginEvents.some(e => e.event === "onTraceEnd"), "onTraceEnd not triggered");
assert.ok(pluginEvents.some(e => e.event === "onFlush"), "onFlush not triggered");

// 3. Verify context propagation headers
const trace = rw.startTrace({ name: "parent-trace", metadata: { sessionId: "opencode-session-xyz" } });
const span = trace.startSpan({ name: "child-span" });

const headers = rw.injectHeaders({}, span);
console.log("Injected Headers:", headers);
assert.strictEqual(headers["x-rabbittize-trace-id"], trace.traceId);
assert.strictEqual(headers["x-rabbittize-span-id"], span.spanId);
assert.strictEqual(headers["x-opencode-session-id"], "opencode-session-xyz");

const extracted = rw.extractHeaders(headers);
console.log("Extracted Context:", extracted);
assert.strictEqual(extracted.traceId, trace.traceId);
assert.strictEqual(extracted.parentSpanId, span.spanId);
assert.strictEqual(extracted.metadata.sessionId, "opencode-session-xyz");

const contextTrace = rw.startTrace({
    name: "propagation-rich-trace",
    sessionId: "session-first-class",
    endUserId: "user-42",
    release: "2026.07.02",
    tags: ["checkout", "agent"],
    prompt: { slug: "checkout-assistant", version: "3", label: "production", hash: "prompt-hash-1" }
});
const contextSpan = contextTrace.startSpan({ name: "nested-generation" });
const richHeaders = rw.injectHeaders({}, contextSpan);
assert.strictEqual(richHeaders["x-rabbittize-session-id"], "session-first-class");
assert.strictEqual(richHeaders["x-rabbittize-end-user-id"], "user-42");
assert.strictEqual(richHeaders["x-rabbittize-release"], "2026.07.02");
assert.strictEqual(richHeaders["x-rabbittize-tags"], "checkout,agent");
assert.strictEqual(richHeaders["x-rabbittize-prompt-slug"], "checkout-assistant");

const richExtracted = rw.extractHeaders(richHeaders);
assert.strictEqual(richExtracted.sessionId, "session-first-class");
assert.strictEqual(richExtracted.endUserId, "user-42");
assert.deepStrictEqual(richExtracted.tags, ["checkout", "agent"]);
assert.strictEqual(richExtracted.prompt.slug, "checkout-assistant");

console.log("=== ALL JS SDK TESTS PASSED ===");
