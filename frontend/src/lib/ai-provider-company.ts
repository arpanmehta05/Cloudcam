export interface AiProviderCompany {
    key: string;
    label: string;
    shortLabel: string;
}

export function getAiProviderCompany(provider: string, model = ""): AiProviderCompany {
    const source = `${provider} ${model}`.toLowerCase();

    if (source.includes("nvidia") || source.includes("nemotron")) {
        return { key: "nvidia", label: "NVIDIA", shortLabel: "NVIDIA" };
    }
    if (source.includes("openai") || /\bgpt-|\bo1\b|\bo3\b/.test(source)) {
        return { key: "openai", label: "OpenAI", shortLabel: "OpenAI" };
    }
    if (source.includes("anthropic") || source.includes("claude")) {
        return { key: "anthropic", label: "Anthropic", shortLabel: "Anthropic" };
    }
    if (source.includes("gemini") || source.includes("google")) {
        return { key: "google", label: "Google", shortLabel: "Google" };
    }
    if (source.includes("mistral") || source.includes("mixtral")) {
        return { key: "mistral", label: "Mistral AI", shortLabel: "Mistral" };
    }
    if (source.includes("bedrock") || source.includes("amazon") || source.includes("aws")) {
        return { key: "aws", label: "AWS Bedrock", shortLabel: "AWS" };
    }

    const fallback = provider && provider !== "custom" ? provider : "Custom";
    return {
        key: fallback.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label: fallback.charAt(0).toUpperCase() + fallback.slice(1),
        shortLabel: fallback.toUpperCase(),
    };
}
