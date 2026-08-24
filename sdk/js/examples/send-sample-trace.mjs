import { RabbittWatchAI } from "../dist/index.js";

const apiKey = process.env.RABBITTIZE_INGEST_KEY;
if (!apiKey) {
  console.error("Missing RABBITTIZE_INGEST_KEY");
  process.exit(1);
}

const endpoint = process.env.RABBITTIZE_ENDPOINT || "http://localhost:4000";
const serviceName = process.env.RABBITTIZE_SERVICE_NAME || "local-test-app";
const environment = process.env.RABBITTIZE_ENVIRONMENT || "prod";
const bedrockApiKey = process.env.BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;

const rwAI = new RabbittWatchAI({
  apiKey,
  endpoint,
  serviceName,
  environment,
  captureInput: true,
  captureOutput: true,
});

const messageText = "Classify this support ticket and return JSON with category and priority: My invoice is wrong and I was charged twice.";

async function callRealBedrock() {
  if (!bedrockApiKey) {
    throw new Error("Missing BEDROCK_API_KEY or AWS_BEARER_TOKEN_BEDROCK");
  }

  const candidates = [
    { region: "us-east-1", model: "amazon.nova-lite-v1:0" },
    { region: "us-east-1", model: "anthropic.claude-3-5-haiku-20241022-v1:0" },
    { region: "us-east-1", model: "us.anthropic.claude-3-5-haiku-20241022-v1:0" },
    { region: "us-west-2", model: "amazon.nova-lite-v1:0" },
    { region: "ap-south-1", model: "amazon.nova-lite-v1:0" }
  ];

  const errors = [];

  for (const candidate of candidates) {
    const url = `https://bedrock-runtime.${candidate.region}.amazonaws.com/model/${encodeURIComponent(candidate.model)}/converse`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bedrockApiKey}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [{ text: messageText }]
          }
        ],
        inferenceConfig: {
          maxTokens: 150,
          temperature: 0.2
        }
      })
    });

    const raw = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }

    if (response.ok) {
      return {
        id: `bedrock_${Date.now()}`,
        model: candidate.model,
        region: candidate.region,
        usage: parsed.usage || {},
        output: parsed.output || parsed,
        raw: parsed
      };
    }

    errors.push({
      region: candidate.region,
      model: candidate.model,
      status: response.status,
      body: parsed
    });
  }

  throw new Error(`Bedrock call failed for all candidates: ${JSON.stringify(errors)}`);
}

const input = [
  { role: "user", content: messageText }
];

const response = await rwAI.trace(
  {
    name: "tickets.classify.real-bedrock",
    provider: "bedrock",
    model: "bedrock-live-call",
    endpoint: "/tickets/classify",
    input,
    metadata: { source: "sdk-demo", realProviderCall: !!bedrockApiKey },
    tags: ["demo", bedrockApiKey ? "real-bedrock" : "simulated-bedrock"],
  },
  async () => {
    if (bedrockApiKey) {
      return await callRealBedrock();
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
    return {
      id: `demo_${Date.now()}`,
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      usage: {
        input_tokens: 1800,
        output_tokens: 120,
      },
      output: {
        category: "billing",
        priority: "high",
      },
    };
  }
);

await rwAI.flush();

console.log("Demo trace sent.");
console.log(JSON.stringify(response, null, 2));
