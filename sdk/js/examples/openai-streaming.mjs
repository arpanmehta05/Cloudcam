// OpenAI streaming with TTFT capture.
//
// Run: RABBITTWATCH_API_KEY=... node examples/openai-streaming.mjs
// The SDK records the time-to-first-token (completionStartTime) via span.firstToken().

import { RabbittWatchAI } from "../dist/index.js";

const rw = new RabbittWatchAI({
  apiKey: process.env.RABBITTWATCH_API_KEY || "demo-key",
  endpoint: process.env.RABBITTWATCH_ENDPOINT,
  serviceName: "streaming-example",
  captureOutput: true,
});

// Simulated OpenAI streaming response (replace with `openai` client stream).
async function* fakeOpenAIStream() {
  const tokens = ["Hello", ",", " world", "!"];
  for (const token of tokens) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    yield { choices: [{ delta: { content: token } }] };
  }
}

async function main() {
  const trace = rw.startTrace({ name: "chat.stream", provider: "openai", model: "gpt-4o" });
  const span = trace.startSpan({ name: "openai.chat.completions", kind: "llm", provider: "openai", model: "gpt-4o" });

  let output = "";
  let firstTokenSeen = false;
  for await (const chunk of fakeOpenAIStream()) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      if (!firstTokenSeen) {
        span.firstToken(); // record TTFT
        firstTokenSeen = true;
      }
      output += delta;
    }
  }

  span.end({ status: "success", output, promptTokens: 12, completionTokens: 4 });
  await trace.flush();
  console.log("Streamed output:", output);
  await rw.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
