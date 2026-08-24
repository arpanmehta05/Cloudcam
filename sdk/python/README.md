# RabbittWatch AI Observability Python SDK

A lightweight Python SDK to track LLM costs, tokens, latencies, error states, and distributed traces in RabbittWatch.

## Installation

```bash
pip install .
```

## Basic Usage

```python
from rabbittwatch.client import RabbittWatchAI

rw_ai = RabbittWatchAI(
    api_key="rw_live_xxxxx",
    environment="prod",
    service_name="customer-support"
)

# Wrapping a call
response = rw_ai.trace(
    name="agent.answer",
    provider="openai",
    model="gpt-4o",
    input="Hello!",
    fn=lambda: openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello!"}]
    )
)
```

### Trace Context Manager & Decorators

You can trace code using context managers:

```python
with rw_ai.trace("manual.step", provider="openai", model="gpt-4o") as trace:
    # Run code...
    trace.spans[0].end(output="Processed result")
```

Or using python decorators:

```python
@rw_ai.trace_decorator(name="llm_agent_kickoff")
def kickoff_agent(task_description):
    # Agent logic...
    return {"output": "Completed task"}
```

---

## Security & Advanced Sanitization

Configure recursive object redaction and custom scrubbers:

```python
import re

rw_ai = RabbittWatchAI(
    api_key="rw_live_xxxxx",
    captureInput=True,
    captureOutput=True,
    
    # Custom regex compilation rules
    redactPatterns=[re.compile(r"custom-key-\d+", re.IGNORECASE)],
    # Custom sanitization lambda/function
    customRedactFn=lambda text: text.replace("confidential-info", "[scrubbed]")
)
```

---

## Lifecycle Plugins System

Create and register custom plugins to inspect or pipe telemetry:

```python
from rabbittwatch import RabbittWatchPlugin

class CustomMetricsPlugin(RabbittWatchPlugin):
    def __init__(self):
        super().__init__("CustomMetricsPlugin")
        
    def on_span_end(self, span, options: dict) -> None:
        print(f"Span ended: {span.span_id}")

rw_ai.register_plugin(CustomMetricsPlugin())
```

---

## Context Propagation (OpenCode & Microservices)

Share trace context over HTTP or event boundaries (captures `x-opencode-session-id`, `x-rabbittize-trace-id`, etc.):

```python
# Service A: Inject headers
trace = rw_ai.start_trace("parent-trace", metadata={"sessionId": "opencode-session-xyz"})
span = trace.start_span({"name": "sub-step"})

headers = {}
headers = rw_ai.inject_headers(headers, span)

# Service B: Extract headers
extracted = rw_ai.extract_headers(received_headers)
sub_trace = rw_ai.start_trace("child-trace", **extracted)
```

