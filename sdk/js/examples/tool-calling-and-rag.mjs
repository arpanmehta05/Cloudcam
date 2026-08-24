// Tool calling + RAG retrieval tracing, plus prompt resolve and score helpers.
//
// Run: RABBITTWATCH_API_KEY=... node examples/tool-calling-and-rag.mjs

import { RabbittWatchAI } from "../dist/index.js";

const rw = new RabbittWatchAI({
  apiKey: process.env.RABBITTWATCH_API_KEY || "demo-key",
  endpoint: process.env.RABBITTWATCH_ENDPOINT,
  serviceName: "agent-example",
  captureInput: true,
  captureOutput: true,
});

async function retrieve(query) {
  // Replace with a real vector store lookup.
  return [
    { id: "doc-1", text: "RabbittWatch traces AI apps.", score: 0.91 },
    { id: "doc-2", text: "Spans nest under a trace.", score: 0.82 },
  ];
}

async function main() {
  // Prompt resolution with cache + inline fallback so the app never hard-fails.
  const prompt = await rw
    .getPrompt("support-answer", { label: "production", fallback: { template: "Answer: {{question}}" } })
    .catch(() => ({ template: "Answer: {{question}}" }));

  const trace = rw.startTrace({ name: "agent.answer", prompt, sessionId: "sess-42", endUserId: "user-7" });

  // RAG retrieval span (embedding + vector search).
  const ragSpan = trace.startSpan({ name: "retrieval", kind: "retriever", input: { query: "what is a span?" } });
  const docs = await retrieve("what is a span?");
  ragSpan.end({ status: "success", output: docs, metadata: { corpus: "docs", topK: docs.length } });

  // Tool call span.
  const toolSpan = trace.startSpan({ name: "tool.calculator", kind: "tool", input: { expression: "2+2" } });
  toolSpan.end({ status: "success", output: { result: 4 } });

  // LLM generation span with token usage.
  const llmSpan = trace.startSpan({ name: "openai.chat", kind: "llm", provider: "openai", model: "gpt-4o", prompt });
  llmSpan.end({ status: "success", output: "A span is a unit of work.", promptTokens: 220, completionTokens: 18 });

  await trace.flush();

  // Attach a numeric quality score to the trace.
  await rw
    .score({ name: "helpfulness", traceId: trace.traceId, value: 92, comment: "grounded and concise" })
    .catch((error) => console.warn("score failed:", error.message));

  await rw.close();
  console.log("Traced agent run:", trace.traceId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
