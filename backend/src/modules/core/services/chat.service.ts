// Chat Service — Two-stage Gemini RAG pipeline
import { z } from "zod";
import { startChat, isGeminiConfigured, generateJsonContent } from "../../../providers/gemini.provider";
import { CLASSIFIER_SYSTEM_PROMPT, CLASSIFIER_USER_PROMPT, parseClassifierResponse } from "../../../data/classifier-prompts";
import { SUB_PROMPTS, selectPrompts } from "../../../data/sub-prompts";
import { buildFactSheet, validateCitations, type Fact } from "../../../data/fact-builder";
import { getOrCreateSession, updateSession, formatHistory } from "../../../store/session-store";
import { generateFollowUps } from "../../../models/chat.model";
import { planActions } from "../../../services/aws/action-planner";
import { AppError } from "../../../errors/app-error";

const GROUNDING_FAIL_THRESHOLD = 0.6;
const FACT_CHAR_BUDGET = 10000;
const STRICT_GROUNDING_INTENTS = new Set([
    "infrastructure_action",
    "debugging",
    "security_audit",
    "performance_tuning",
    "capacity_planning",
    "compliance_check",
]);

const SubPromptOutputSchema = z.object({
    content: z.string().optional(),
    citations: z.array(z.string()).optional(),
    recommendations: z.array(z.unknown()).optional(),
    anomalies: z.array(z.unknown()).optional(),
    services: z.array(z.unknown()).optional(),
    actionIntent: z.unknown().optional(),
    findings: z.array(z.unknown()).optional(),
    tuning: z.array(z.unknown()).optional(),
    pillars: z.record(z.string(), z.unknown()).optional(),
    checks: z.array(z.unknown()).optional(),
    capacityStatus: z.array(z.unknown()).optional(),
}).passthrough();

function rankFactsForPrompt(
    facts: Fact[],
    message: string,
    services: string[]
) {
    const query = message.toLowerCase();
    const serviceSet = new Set(services.map((service) => service.toLowerCase()));

    return [...facts]
        .map((fact) => {
            let score = 0;
            const content = fact.content.toLowerCase();
            const source = fact.source.toLowerCase();

            if (fact.type === "calculated") score += 6;
            if (fact.type === "knowledge") score += 7;
            if (fact.type === "billing" || fact.type === "security") score += 4;
            if (fact.type === "log") score += 4;
            if (fact.resourceType && serviceSet.has(fact.resourceType.toLowerCase())) score += 5;
            if ([...serviceSet].some((service) => content.includes(service) || source.includes(service))) score += 3;
            if (content.includes("idle") || content.includes("error") || content.includes("threat") || content.includes("save")) score += 2;
            if (query.includes("cost") && fact.type === "billing") score += 3;
            if ((query.includes("security") || query.includes("threat")) && fact.type === "security") score += 3;
            if ((query.includes("slow") || query.includes("latency") || query.includes("performance")) && fact.type === "metric") score += 2;
            if ((query.includes("log") || query.includes("error") || query.includes("debug") || query.includes("exception") || query.includes("vps") || query.includes("docker") || query.includes("pm2")) && fact.type === "log") score += 5;
            if ((query.includes("docs") || query.includes("documentation") || query.includes("/docs") || query.includes("faq") || query.includes("simulation") || query.includes("terraform") || query.includes("ai observability") || query.includes("trace") || query.includes("ingest") || query.includes("product") || query.includes("how do i") || query.includes("where")) && fact.type === "knowledge") score += 8;

            return { fact, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((item) => item.fact);
}

function buildPromptFactSheet(
    facts: Fact[],
    maxChars: number
): { factSheet: string; selectedFacts: typeof facts } {
    const selectedFacts: typeof facts = [];
    let used = 0;

    for (const fact of facts) {
        let line = `[${fact.id}] ${fact.content} | Source: ${fact.source}`;
        if (fact.resourceId) line += ` | Resource: ${fact.resourceId}`;
        if (fact.region) line += ` | Region: ${fact.region}`;
        line += "\n";

        if (used + line.length > maxChars && selectedFacts.length >= 10) break;
        selectedFacts.push(fact);
        used += line.length;
    }

    return {
        selectedFacts,
        factSheet: selectedFacts
            .map((fact) => {
                let line = `[${fact.id}] ${fact.content} | Source: ${fact.source}`;
                if (fact.resourceId) line += ` | Resource: ${fact.resourceId}`;
                if (fact.region) line += ` | Region: ${fact.region}`;
                return line;
            })
            .join("\n"),
    };
}

export async function processChat(message: string, sessionId?: string, workspaceId: string = "", roleArn?: string, externalId?: string) {
    const startTime = Date.now();

    if (!isGeminiConfigured()) throw new Error("Gemini API key not configured");

    const session = getOrCreateSession(sessionId, workspaceId);
    const history = formatHistory(session.messages, session.context);

    // STAGE 1: INTENT CLASSIFICATION
    const stage1Start = Date.now();
    const classifierChat = startChat([
        { role: "user", parts: [{ text: CLASSIFIER_SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Understood. I will classify queries and return JSON only." }] },
    ]);
    const classifierResult = await classifierChat.sendMessage(CLASSIFIER_USER_PROMPT(message, history));
    const parsedIntent = parseClassifierResponse(classifierResult.response.text(), message);
    const stage1Time = Date.now() - stage1Start;

    if ((parsedIntent.confidence ?? 0) < 0.45) {
        const clarification = parsedIntent.clarificationQuestion
            || "Can you clarify whether you want billing, health, optimization, security, or an infrastructure action?";
        const summary = `I need one clarification before I fetch and analyze data: ${clarification}`;
        updateSession(session.id, message, summary, parsedIntent, undefined, []);

        return {
            success: true,
            sessionId: session.id,
            response: {
                summary,
                details: { clarificationRequired: true },
                followUp: [
                    "Show current billing and cost drivers",
                    "Run a resource health check",
                    "Find cost optimization opportunities",
                ],
            },
            evidence: [],
            metadata: {
                intent: parsedIntent.intent,
                services: parsedIntent.services,
                stage1Time,
                stage2Time: 0,
                totalTime: Date.now() - startTime,
                classifierConfidence: parsedIntent.confidence ?? 0,
                needsClarification: true,
            },
        };
    }

    // DATA FETCHING
    const { facts, factSheet, rawData, dataQuality } = await buildFactSheet(parsedIntent, workspaceId, roleArn, externalId, message);
    const rankedFacts = rankFactsForPrompt(facts, message, parsedIntent.services);
    const { factSheet: promptFactSheet, selectedFacts } = buildPromptFactSheet(
        rankedFacts,
        FACT_CHAR_BUDGET
    );

    // STAGE 2: FOCUSED SUB-PROMPTS
    const stage2Start = Date.now();
    const promptsToRun = selectPrompts(parsedIntent.intent);

    const subResults = await Promise.all(
        promptsToRun.map(async (promptKey) => {
            const subPrompt = SUB_PROMPTS[promptKey];
            const fullPrompt = `${subPrompt.prompt}\n\n## FACTS (from connected data sources at ${new Date().toISOString()})\n${promptFactSheet}\n\n## DATA QUALITY\n${JSON.stringify(dataQuality.sourceStatuses)}\n\n## USER QUERY\n"${message}"\n\nRULES:\n- Every claim must cite FACT IDs from the provided list.\n- citations must be a non-empty array when content is present.\n\nReturn JSON only.`;
            try {
                const raw = await generateJsonContent(fullPrompt);
                const parsed = SubPromptOutputSchema.safeParse(raw);
                if (!parsed.success) {
                    throw new AppError({
                        code: "ERR_AI_OUTPUT_SCHEMA_INVALID",
                        message: `Sub-prompt ${promptKey} returned invalid JSON shape`,
                        status: 502,
                        retryable: true,
                        details: parsed.error.flatten(),
                    });
                }
                const citations = parsed.data.citations || [];
                const hasContent = Boolean(parsed.data.content && parsed.data.content.trim());
                if (hasContent && citations.length === 0) {
                    throw new AppError({
                        code: "ERR_AI_OUTPUT_SCHEMA_INVALID",
                        message: `Sub-prompt ${promptKey} returned content without citations`,
                        status: 502,
                        retryable: true,
                    });
                }
                return { key: promptKey, success: true, data: parsed.data };
            } catch (error) {
                console.error(`Sub-prompt ${promptKey} failed:`, error);
                return { key: promptKey, success: false, data: null, error };
            }
        })
    );
    const stage2Time = Date.now() - stage2Start;

    if (promptsToRun.length > 0 && !subResults.some((r) => r.success)) {
        throw new AppError({
            code: "ERR_AI_OUTPUT_SCHEMA_INVALID",
            message: "All chat sub-prompts returned invalid AI output",
            status: 502,
            retryable: true,
        });
    }

    // MERGE RESPONSES
    let summary = "";
    const allCitations: string[] = [];
    const details: any = {};
    for (const result of subResults) {
        if (!result.success || !result.data) continue;
        summary += (result.data.content || "") + " ";
        if (result.data.citations) allCitations.push(...result.data.citations);
        if (result.key === "optimization" && result.data.recommendations) details.recommendations = result.data.recommendations;
        if (result.key === "anomaly_detection" && result.data.anomalies) details.anomalies = result.data.anomalies;
        if (result.key === "health_check" && result.data.services) details.health = result.data.services;
        if (result.key === "infrastructure_action" && result.data.actionIntent) details.actionIntent = result.data.actionIntent;
        if (result.key === "security_audit" && result.data.findings) details.securityFindings = result.data.findings;
        if (result.key === "performance_tuning" && result.data.tuning) details.performanceTuning = result.data.tuning;
        if (result.key === "architecture_review" && result.data.pillars) details.architectureReview = result.data.pillars;
        if (result.key === "compliance_check" && result.data.checks) details.complianceChecks = result.data.checks;
        if (result.key === "capacity_planning" && result.data.capacityStatus) details.capacityPlanning = result.data.capacityStatus;
    }
    summary = summary.trim() || "I analyzed your infrastructure but couldn't generate specific insights. Try asking about billing, health, or optimization.";

    const validation = validateCitations(allCitations, selectedFacts);
    const groundingScore = allCitations.length > 0 ? validation.found.length / allCitations.length : 0;
    const shouldFailOnLowGrounding = STRICT_GROUNDING_INTENTS.has(parsedIntent.intent);

    if (groundingScore < GROUNDING_FAIL_THRESHOLD && shouldFailOnLowGrounding) {
        throw new AppError({
            code: "ERR_AI_OUTPUT_SCHEMA_INVALID",
            message: "Grounding score below threshold for high-impact intent",
            status: 502,
            retryable: true,
            details: {
                groundingScore,
                threshold: GROUNDING_FAIL_THRESHOLD,
                missingCitations: validation.missing,
            },
        });
    }

    let degraded = false;
    let actionPlans: any[] = [];
    if (groundingScore < GROUNDING_FAIL_THRESHOLD && !shouldFailOnLowGrounding) {
        degraded = true;
        summary = "I found partial evidence but not enough fully grounded citations to provide a reliable full answer. Please ask a narrower question (service + timeframe + resource).";
    } else if (parsedIntent.intent === "infrastructure_action") {
        actionPlans = await planActions(message, promptFactSheet);
    }

    const evidence = selectedFacts
        .filter((fact) => validation.found.includes(fact.id))
        .map((fact) => ({ factId: fact.id, content: fact.content, source: fact.source, value: fact.value, unit: fact.unit }));
    const followUp = generateFollowUps(parsedIntent.intent, parsedIntent.services);

    // Extract recommendations for session tracking
    const recsForSession = (details.recommendations || []).map((r: any) => ({
        title: r.title || r.description || "",
        resourceId: r.resourceId,
        savings: r.savings,
    }));

    updateSession(session.id, message, summary, parsedIntent, rawData, recsForSession);

    return {
        success: true, sessionId: session.id,
        response: {
            summary,
            details: degraded ? { degradedGrounding: true } : details,
            followUp,
            actionPlans: !degraded && actionPlans.length > 0 ? actionPlans : undefined,
        },
        evidence,
        metadata: {
            intent: parsedIntent.intent,
            services: parsedIntent.services,
            stage1Time,
            stage2Time,
            totalTime: Date.now() - startTime,
            classifierConfidence: parsedIntent.confidence ?? 0,
            grounding: {
                score: Number(groundingScore.toFixed(3)),
                threshold: GROUNDING_FAIL_THRESHOLD,
                totalCitations: allCitations.length,
                validCitations: validation.found.length,
                missingCitations: validation.missing,
                degraded,
            },
            retrieval: {
                totalFacts: facts.length,
                selectedFacts: selectedFacts.length,
                factSheetChars: promptFactSheet.length,
                budgetChars: FACT_CHAR_BUDGET,
            },
            dataQuality,
        },
    };
}
