const { PassThrough } = require("stream");
const controller = require("../dist/controllers/prompt-playground.controller.js");
const userModel = require("../dist/models/user.model.js");
const ingestion = require("../dist/services/ai-provider-ingestion.service.js");
const axiosModule = require("axios");

const axios = axiosModule.default || axiosModule;

async function main() {
    userModel.User.findById = async () => ({ aiApiKeys: {} });
    ingestion.record = async () => ({});

    let captured;
    axios.post = async (url, body, config) => {
        captured = { url, body, headers: config.headers, timeout: config.timeout };
        const stream = new PassThrough();
        setImmediate(() => {
            stream.write(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "Think" } }] })}\n\n`);
            stream.write(`data: ${JSON.stringify({
                choices: [{ delta: { content: "Answer" } }],
                usage: { prompt_tokens: 11, completion_tokens: 7 },
            })}\n\n`);
            stream.write("data: [DONE]\n\n");
            // Deliberately leave the socket open. The controller must stop at [DONE].
        });
        return {
            status: 200,
            data: stream,
        };
    };

    const req = {
        user: { userId: "test-user" },
        body: {
            template: "Hello",
            provider: "openai",
            model: "nemotron-3-ultra-550b-a55b",
            endpoint: "https://integrate.api.nvidia.com/v1",
            temperature: 2,
            maxTokens: 16_384,
            reasoningBudget: 16_384,
            enableThinking: true,
            apiKey: "invalid-test-key",
        },
        setTimeout() {},
    };

    let output;
    const res = {
        statusCode: 200,
        setTimeout() {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(value) {
            output = value;
            return value;
        },
    };

    await controller.runPlayground(req, res);

    const result = {
        status: res.statusCode,
        request: {
            url: captured?.url,
            model: captured?.body?.model,
            temperature: captured?.body?.temperature,
            topP: captured?.body?.top_p,
            maxTokens: captured?.body?.max_tokens,
            reasoningBudget: captured?.body?.reasoning_budget,
            stream: captured?.body?.stream,
            authorization: captured?.headers?.Authorization === "Bearer invalid-test-key"
                ? "Bearer [test-key]"
                : "unexpected",
            timeout: captured?.timeout,
        },
        response: output,
    };

    const valid = result.status === 200
        && result.request.url === "https://integrate.api.nvidia.com/v1/chat/completions"
        && result.request.model === "nvidia/nemotron-3-ultra-550b-a55b"
        && result.request.temperature === 1
        && result.request.topP === 0.95
        && result.request.maxTokens === 16_384
        && result.request.reasoningBudget === 16_384
        && result.request.stream === true
        && result.request.timeout === 120_000
        && result.response?.text === "Think\n\nAnswer"
        && result.response?.usage?.promptTokens === 11
        && result.response?.usage?.completionTokens === 7;

    console.log(JSON.stringify(result, null, 2));
    if (!valid) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
