# RabbittWatch AI Observability SDK

Install:

```bash
npm install @rabbittwatch/ai-observability
```

Configure:

```env
RABBITTIZE_INGEST_KEY=rw_live_xxxxx
RABBITTIZE_ENDPOINT=https://rabbitize-api.rabbitt.ai
RABBITTIZE_SERVICE_NAME=support-api
RABBITTIZE_ENVIRONMENT=prod
```

## Basic Usage

Wrap a provider call:

```ts
import { RabbittWatchAI } from "@rabbittwatch/ai-observability";

const rwAI = new RabbittWatchAI({
  apiKey: process.env.RABBITTIZE_INGEST_KEY!,
  endpoint: process.env.RABBITTIZE_ENDPOINT,
  serviceName: process.env.RABBITTIZE_SERVICE_NAME || "app",
  environment: process.env.RABBITTIZE_ENVIRONMENT || "prod",
});

const response = await rwAI.trace(
  {
    name: "chat.answer",
    provider: "openai",
    model: "gpt-4o",
    endpoint: "/chat",
    input: messages,
  },
  () => openai.chat.completions.create({ model: "gpt-4o", messages })
);
```

Manual spans:

```ts
const trace = rwAI.startTrace({ name: "POST /tickets/classify", endpoint: "/tickets/classify" });
const span = trace.startSpan({
  name: "bedrock.classify",
  kind: "llm",
  provider: "bedrock",
  model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
});

try {
  const result = await bedrockClient.send(command);
  span.end({ status: "success", promptTokens: 1800, completionTokens: 120, output: result });
} catch (error) {
  span.end({ status: "error", error });
  throw error;
} finally {
  await trace.flush();
}
```

---

## Security & Advanced Sanitization
By default, prompt and output previews are redacted for keys (`sk-...`, passwords, secrets, etc.). You can configure deep recursive object redaction and custom scrubbers:

```ts
const rwAI = new RabbittWatchAI({
  apiKey: process.env.RABBITTIZE_INGEST_KEY!,
  captureInput: true,
  captureOutput: true,
  
  // Custom Regex rules
  redactPatterns: [/custom-key-\d+/g],
  // Custom PII/redactor callback
  customRedactFn: (text) => text.replace(/confidential-info/g, "[scrubbed]"),
});
```

---

## Lifecycle Plugins System
Extend SDK capability by registering plugins:

```ts
rwAI.use({
  name: "ConsoleLoggerPlugin",
  onTraceStart(trace, options) {
    console.log(`Trace started: ${trace.traceId}`);
  },
  onSpanEnd(span, options) {
    console.log(`Span ended: ${span.spanId}`);
  }
});
```

---

## Context Propagation (OpenCode & Microservices)
Propagate tracing contexts across HTTP/event boundaries:

```ts
// Service A: Inject headers
const trace = rwAI.startTrace({ name: "agent-workflow", metadata: { sessionId: "opencode-123" } });
const span = trace.startSpan({ name: "task-step" });

let headers = {};
headers = rwAI.injectHeaders(headers, span);

// Service B: Extract headers
const extractedContext = rwAI.extractHeaders(incomingHeaders);
const downstreamTrace = rwAI.startTrace(extractedContext);
```

