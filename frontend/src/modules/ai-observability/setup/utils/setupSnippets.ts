export type SetupSnippetId =
  | "python-sdk"
  | "js-sdk"
  | "langchain-python"
  | "langchain-js"
  | "litellm"
  | "crewai"
  | "agno"
  | "otel-langfuse";

export type SetupSnippetContext = {
  key: string;
  endpoint: string;
  service: string;
  environment: string;
};

export type SetupSnippet = {
  id: SetupSnippetId;
  label: string;
  description: string;
  install: string;
  env: string;
  code: string;
};

type SetupSnippetTemplate = Omit<SetupSnippet, "env" | "code"> & {
  code: (ctx: SetupSnippetContext) => string;
  env?: (ctx: SetupSnippetContext) => string;
};

function shellEnv(ctx: SetupSnippetContext) {
  return [
    `RABBITTIZE_INGEST_KEY=${ctx.key}`,
    `RABBITTIZE_ENDPOINT=${ctx.endpoint}`,
    `RABBITTIZE_SERVICE_NAME=${ctx.service}`,
    `RABBITTIZE_ENVIRONMENT=${ctx.environment}`,
  ].join("\n");
}

function otelEnv(ctx: SetupSnippetContext) {
  return [
    `LANGFUSE_PUBLIC_KEY=${ctx.key}`,
    `OTEL_EXPORTER_OTLP_ENDPOINT=${ctx.endpoint}/api/ai-observability/otel/v1/traces`,
    "OTEL_EXPORTER_OTLP_PROTOCOL=http/json",
    "OTEL_EXPORTER_OTLP_HEADERS=X-Rabbittize-Ingest-Key=${LANGFUSE_PUBLIC_KEY}",
    `OTEL_SERVICE_NAME=${ctx.service}`,
    `DEPLOYMENT_ENVIRONMENT=${ctx.environment}`,
  ].join("\n");
}

const templates: SetupSnippetTemplate[] = [
  {
    id: "python-sdk",
    label: "Python SDK",
    description: "Manual traces, spans, prompt context, and scores.",
    install: "pip install rabbittwatch-ai-observability",
    code: (ctx) => `import os
from rabbittwatch.client import RabbittWatchAI

rw = RabbittWatchAI(
    apiKey=os.environ["RABBITTIZE_INGEST_KEY"],
    endpoint=os.environ.get("RABBITTIZE_ENDPOINT"),
    serviceName="${ctx.service}",
    environment="${ctx.environment}",
    captureOutput=True,
)

trace = rw.start_trace("chat.completion", sessionId="sess-1", endUserId="user-1")
span = trace.start_span({
    "name": "openai.chat",
    "kind": "llm",
    "provider": "openai",
    "model": "gpt-4o-mini",
})

# result = client.chat.completions.create(...)
span.end(status="success", output="Hello from Cloudcam", promptTokens=12, completionTokens=8)
trace.flush()
rw.close()`,
  },
  {
    id: "js-sdk",
    label: "JS / TypeScript SDK",
    description: "Wrap one async LLM call with a typed trace helper.",
    install: "npm install @rabbittwatch/ai-observability",
    code: (ctx) => `import { RabbittWatchAI } from "@rabbittwatch/ai-observability";

const rw = new RabbittWatchAI({
  apiKey: process.env.RABBITTIZE_INGEST_KEY!,
  endpoint: process.env.RABBITTIZE_ENDPOINT,
  serviceName: "${ctx.service}",
  environment: "${ctx.environment}",
  captureOutput: true,
});

const result = await rw.trace(
  { name: "chat.completion", provider: "openai", model: "gpt-4o-mini" },
  async () => {
    // return await openai.chat.completions.create(...)
    return { message: "Hello from Cloudcam" };
  }
);

await rw.flush();`,
  },
  {
    id: "langchain-python",
    label: "LangChain Python",
    description: "Attach the Cloudcam tracer as a LangChain callback.",
    install: "pip install rabbittwatch-ai-observability langchain-core",
    code: (ctx) => `import os
from rabbittwatch.client import RabbittWatchAI
from rabbittwatch.integrations import RabbittWatchLangChainTracer

rw = RabbittWatchAI(
    apiKey=os.environ["RABBITTIZE_INGEST_KEY"],
    endpoint=os.environ.get("RABBITTIZE_ENDPOINT"),
    serviceName="${ctx.service}",
    environment="${ctx.environment}",
    captureInput=True,
    captureOutput=True,
)
tracer = RabbittWatchLangChainTracer(rw, environment="${ctx.environment}", service_name="${ctx.service}")

# chain.invoke({"question": "What changed?"}, config={"callbacks": [tracer]})
rw.flush()`,
  },
  {
    id: "langchain-js",
    label: "LangChain JS",
    description: "Use the JS tracer with LangChain callback config.",
    install: "npm install @rabbittwatch/ai-observability @langchain/core",
    code: (ctx) => `import { RabbittWatchAI } from "@rabbittwatch/ai-observability";
import { RabbittWatchLangChainTracer } from "@rabbittwatch/ai-observability/langchain";

const rw = new RabbittWatchAI({
  apiKey: process.env.RABBITTIZE_INGEST_KEY!,
  endpoint: process.env.RABBITTIZE_ENDPOINT,
  serviceName: "${ctx.service}",
  environment: "${ctx.environment}",
  captureInput: true,
  captureOutput: true,
});
const tracer = new RabbittWatchLangChainTracer(rw, {
  serviceName: "${ctx.service}",
  environment: "${ctx.environment}",
});

// await chain.invoke({ question: "What changed?" }, { callbacks: [tracer] });
await rw.flush();`,
  },
  {
    id: "litellm",
    label: "LiteLLM",
    description: "Register a LiteLLM success and failure callback.",
    install: "pip install rabbittwatch-ai-observability litellm",
    code: (ctx) => `import os
import litellm
from rabbittwatch.client import RabbittWatchAI
from rabbittwatch.integrations import register_litellm

rw = RabbittWatchAI(
    apiKey=os.environ["RABBITTIZE_INGEST_KEY"],
    endpoint=os.environ.get("RABBITTIZE_ENDPOINT"),
    serviceName="${ctx.service}",
    environment="${ctx.environment}",
    captureInput=True,
    captureOutput=True,
)
register_litellm(rw)

response = litellm.completion(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Summarize this incident"}],
    metadata={"traceName": "litellm.chat"},
)
rw.flush()`,
  },
  {
    id: "crewai",
    label: "CrewAI",
    description: "Wrap a Crew kickoff so tasks become trace spans.",
    install: "pip install rabbittwatch-ai-observability crewai",
    code: (ctx) => `import os
from rabbittwatch.client import RabbittWatchAI
from rabbittwatch.integrations import RabbittWatchCrewAI

rw = RabbittWatchAI(
    apiKey=os.environ["RABBITTIZE_INGEST_KEY"],
    endpoint=os.environ.get("RABBITTIZE_ENDPOINT"),
    serviceName="${ctx.service}",
    environment="${ctx.environment}",
    captureOutput=True,
)

# crew = Crew(agents=[...], tasks=[...])
crew = RabbittWatchCrewAI(rw).trace_crew(crew, trace_name="research-crew")
result = crew.kickoff()
rw.flush()`,
  },
  {
    id: "agno",
    label: "Agno",
    description: "Wrap an Agno agent run with a chain span.",
    install: "pip install rabbittwatch-ai-observability agno",
    code: (ctx) => `import os
from rabbittwatch.client import RabbittWatchAI
from rabbittwatch.integrations import RabbittWatchAgno

rw = RabbittWatchAI(
    apiKey=os.environ["RABBITTIZE_INGEST_KEY"],
    endpoint=os.environ.get("RABBITTIZE_ENDPOINT"),
    serviceName="${ctx.service}",
    environment="${ctx.environment}",
    captureOutput=True,
)

# agent = Agent(...)
agent = RabbittWatchAgno(rw).instrument_agent(agent, agent_name="support-agent")
response = agent.run("Investigate the latest failed deployment")
rw.flush()`,
  },
  {
    id: "otel-langfuse",
    label: "OpenTelemetry / Langfuse",
    description: "Point OTLP JSON traces at the existing OTel ingest endpoint.",
    install: "pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http",
    env: otelEnv,
    code: (ctx) => `from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

provider = TracerProvider(resource=Resource.create({"service.name": "${ctx.service}"}))
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("${ctx.service}")
with tracer.start_as_current_span("langfuse-compatible-call") as span:
    span.set_attribute("llm.provider", "openai")
    span.set_attribute("llm.model", "gpt-4o-mini")
    # run your Langfuse or OTel-instrumented LLM call here
    pass`,
  },
];

export const setupSnippetOptions = templates.map(({ id, label, description }) => ({
  id,
  label,
  description,
}));

export function getSetupSnippet(id: SetupSnippetId, ctx: SetupSnippetContext): SetupSnippet {
  const template = templates.find((item) => item.id === id) ?? templates[0];

  return {
    id: template.id,
    label: template.label,
    description: template.description,
    install: template.install,
    env: (template.env ?? shellEnv)(ctx),
    code: template.code(ctx),
  };
}

export function getQuickstartText(snippet: SetupSnippet) {
  return [snippet.install, snippet.env, snippet.code].join("\n\n");
}
