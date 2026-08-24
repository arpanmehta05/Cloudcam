// Google Gemini AI Provider (Generative Language API)
import { GoogleGenerativeAI, type GoogleGenerativeAI as GenAIType } from "@google/generative-ai";
import { config } from "../config/env";
import { AppError } from "../errors/app-error";

function assertConfigured() {
    if (!config.geminiApiKey) {
        throw new AppError({
            code: "ERR_AI_PROVIDER_NOT_CONFIGURED",
            message: "Gemini API key not configured",
            status: 500,
            retryable: false,
        });
    }
}

function getGenAI(): GenAIType {
    assertConfigured();
    return new GoogleGenerativeAI(config.geminiApiKey);
}

export function isGeminiConfigured(): boolean {
    return !!config.geminiApiKey;
}

export async function generateContent(prompt: string): Promise<string> {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
        model: config.geminiModel,
        generationConfig: { temperature: 0.2 },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Generate content with JSON output schema.
 */
export async function generateJsonContent(prompt: string): Promise<any> {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
        model: config.geminiModel,
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
        },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new AppError({
            code: "ERR_AI_OUTPUT_INVALID_JSON",
            message: "Gemini returned invalid JSON output",
            status: 502,
            retryable: true,
            details: { preview: text.slice(0, 500) },
        });
    }
}

interface ChatHistoryItem {
    role: string;
    parts: { text: string }[];
}

export function startChat(history: ChatHistoryItem[]) {
    assertConfigured();
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: config.geminiModel });

    // Map internal roles to Gemini roles: "model" -> "model", "user" -> "user"
    const geminiHistory: Array<{ role: "user" | "model"; parts: { text: string }[] }> = history
        .filter((item) => item.role === "user" || item.role === "model")
        .map((item) => ({
            role: item.role as "user" | "model",
            parts: item.parts,
        }));

    const chat = model.startChat({ history: geminiHistory });

    return {
        async sendMessage(text: string) {
            const result = await chat.sendMessage(text);
            return {
                response: {
                    text: () => result.response.text(),
                },
            };
        },
    };
}
