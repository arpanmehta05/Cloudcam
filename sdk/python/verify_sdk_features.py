import sys
import os
import re

# Add the current directory to path to import rabbittwatch
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from rabbittwatch import RabbittWatchAI, RabbittWatchPlugin

print("=== Testing RabbittWatch Python SDK Upgraded Features ===")

plugin_events = []

class TestPlugin(RabbittWatchPlugin):
    def __init__(self):
        super().__init__("TestPlugin")

    def on_trace_start(self, trace, options: dict) -> None:
        plugin_events.append({"event": "on_trace_start", "trace_id": trace.trace_id, "name": options.get("name")})

    def on_trace_end(self, trace) -> None:
        plugin_events.append({"event": "on_trace_end", "trace_id": trace.trace_id})

    def on_span_start(self, span, options: dict) -> None:
        plugin_events.append({"event": "on_span_start", "span_id": span.span_id, "name": options.get("name")})

    def on_span_end(self, span, options: dict) -> None:
        plugin_events.append({"event": "on_span_end", "span_id": span.span_id})

    def on_flush(self, envelope: dict) -> None:
        plugin_events.append({"event": "on_flush", "trace_id": envelope["trace"]["traceId"], "span_count": len(envelope["spans"])})

# Configure sanitization patterns
redact_patterns = [re.compile(r"custom-secret-\d+", re.IGNORECASE)]
custom_redact_fn = lambda text: text.replace("scrub-me", "[scrubbed]")

rw = RabbittWatchAI(
    apiKey="rw_live_test_api_key_12345",
    endpoint="http://localhost:4000",
    captureInput=True,
    captureOutput=True,
    redactPatterns=redact_patterns,
    customRedactFn=custom_redact_fn,
    flushIntervalMs=0,  # manual flush
)

rw.register_plugin(TestPlugin())

# Trace context execution with deeply nested sensitive data
nested_input = {
    "messages": [{"role": "user", "content": "Tell me a joke about safety"}],
    "config": {
        "api_key": "super-secret-key-to-hide",
        "nested": {
            "password": "my-secure-password",
            "customToken": "custom-secret-9999",
            "flag": "scrub-me-please"
        }
    }
}

with rw.trace("test.redaction.flow", input=nested_input, metadata={"sessionId": "session_opencode_12345"}) as trace:
    assert trace.trace_id

rw.flush()

print("Recorded Plugin Events:", plugin_events)
assert any(e["event"] == "on_trace_start" for e in plugin_events), "on_trace_start not triggered"
assert any(e["event"] == "on_span_start" for e in plugin_events), "on_span_start not triggered"
assert any(e["event"] == "on_span_end" for e in plugin_events), "on_span_end not triggered"
assert any(e["event"] == "on_trace_end" for e in plugin_events), "on_trace_end not triggered"
assert any(e["event"] == "on_flush" for e in plugin_events), "on_flush not triggered"

# Context Propagation Headers Testing
trace_obj = rw.start_trace("parent-trace", metadata={"sessionId": "opencode-session-xyz"})
span_obj = trace_obj.start_span({"name": "child-span"})

headers = rw.inject_headers({}, span_obj)
print("Injected Headers:", headers)
assert headers["x-rabbittize-trace-id"] == trace_obj.trace_id
assert headers["x-rabbittize-span-id"] == span_obj.span_id
assert headers["x-opencode-session-id"] == "opencode-session-xyz"

extracted = rw.extract_headers(headers)
print("Extracted Context:", extracted)
assert extracted["traceId"] == trace_obj.trace_id
assert extracted["parentSpanId"] == span_obj.span_id
assert extracted["metadata"]["sessionId"] == "opencode-session-xyz"

context_trace = rw.start_trace(
    "propagation-rich-trace",
    sessionId="session-first-class",
    endUserId="user-42",
    release="2026.07.02",
    tags=["checkout", "agent"],
    prompt={"slug": "checkout-assistant", "version": "3", "label": "production", "hash": "prompt-hash-1"}
)
context_span = context_trace.start_span({"name": "nested-generation"})
rich_headers = rw.inject_headers({}, context_span)
assert rich_headers["x-rabbittize-session-id"] == "session-first-class"
assert rich_headers["x-rabbittize-end-user-id"] == "user-42"
assert rich_headers["x-rabbittize-release"] == "2026.07.02"
assert rich_headers["x-rabbittize-tags"] == "checkout,agent"
assert rich_headers["x-rabbittize-prompt-slug"] == "checkout-assistant"

rich_extracted = rw.extract_headers(rich_headers)
assert rich_extracted["sessionId"] == "session-first-class"
assert rich_extracted["endUserId"] == "user-42"
assert rich_extracted["tags"] == ["checkout", "agent"]
assert rich_extracted["prompt"]["slug"] == "checkout-assistant"

print("=== ALL PYTHON SDK TESTS PASSED ===")
