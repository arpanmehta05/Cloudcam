import { isGeminiConfigured, generateJsonContent } from "../../../providers/gemini.provider";
import { IResizeMigrationJob, IResizeMigrationTask } from "../models/resize-migration.model";
import { AIExplanationResult } from "../../../types/resize-migration.types";

export async function explainTaskFailure(
    job: IResizeMigrationJob,
    task: IResizeMigrationTask
): Promise<AIExplanationResult> {
    if (!isGeminiConfigured()) {
        return {
            explanation: "Rabbittwatch AI service is not currently configured. Please ensure GEMINI_API_KEY is defined in your backend environment variables.",
            likelyCause: "AI provider not configured.",
            remediationSteps: [
                "Navigate to your backend server env variables.",
                "Ensure GEMINI_API_KEY is supplied and correct.",
                "Restart the Rabbittwatch API server."
            ],
            alternativeFallback: "Please refer to the task Error Code and suggested remediation tips in the timeline logs."
        };
    }

    const logSnippets = task.logs
        .map((l) => `[${l.level.toUpperCase()}] [${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}`)
        .join("\n");

    const prompt = `
You are an expert cloud migration systems architect assisting a user. A migration step has failed in a server resize migration workflow.
Based on the details below, explain why this step failed and provide clear, actionable steps to fix it.

Job Details:
- Provider: ${job.provider.toUpperCase()}
- Region: ${job.region}
- Source Server ID: ${job.sourceServerId}
- Target Size: ${job.targetServerType}
- Cutover Mode: ${job.cutoverMode}

Failed Task:
- Title: ${task.title}
- Key: ${task.key}
- Error Code: ${task.errorCode || "Unknown"}
- Error Message: ${task.errorMessage || "No explicit error message"}

Detailed Task Logs:
${logSnippets || "No logs recorded for this task."}

Respond ONLY with a JSON object in this exact schema:
{
  "explanation": "A user-friendly, clear explanation (2-3 sentences) of what failed and its impact.",
  "likelyCause": "A single sentence summary of the root cause.",
  "remediationSteps": ["List item 1 of how the user can fix this.", "List item 2 of how the user can fix this."],
  "alternativeFallback": "A single sentence describing fallback actions (e.g. manual DNS configuration, SSH port changes)."
}
`;

    try {
        const result = await generateJsonContent(prompt);
        return {
            explanation: result.explanation || "Failed to analyze error logs.",
            likelyCause: result.likelyCause || "Unknown cause.",
            remediationSteps: result.remediationSteps || ["Check the system configurations manually."],
            alternativeFallback: result.alternativeFallback || "Review job parameters and retry."
        };
    } catch (err: any) {
        console.error("[AI Explain] Failed to generate AI content:", err);
        return {
            explanation: `AI log analysis encountered an error: ${err.message || err}.`,
            likelyCause: "Analysis runtime error.",
            remediationSteps: ["Inspect the raw execution logs for indicators.", "Retry the AI explanation generation."],
            alternativeFallback: "Refer to the error knowledge base for this error signature."
        };
    }
}
