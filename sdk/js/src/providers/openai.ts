export function extractUsage(response: unknown): { promptTokens?: number; completionTokens?: number; totalTokens?: number } {
    const value = response as any;
    const usage = value?.usage || value?.usageMetadata || value?.response?.usage || {};

    const promptTokens = usage.prompt_tokens ?? usage.promptTokenCount ?? usage.input_tokens;
    const completionTokens = usage.completion_tokens ?? usage.candidatesTokenCount ?? usage.output_tokens;
    const totalTokens = usage.total_tokens ?? usage.totalTokenCount;

    return { promptTokens, completionTokens, totalTokens };
}
