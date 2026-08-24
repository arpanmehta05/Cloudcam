// In-memory session store with rich context tracking
import { ChatMessage, ParsedIntent, ConversationSession, SessionContext } from "../models/chat.model";
import { extractResourceIds } from "../data/fact-builder";

const sessions = new Map<string, ConversationSession>();
const SESSION_TTL = 30 * 60 * 1000;

function generateId(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function getOrCreateSession(sessionId?: string, userId?: string): ConversationSession {
    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        if (userId && !session.userId) {
            session.userId = userId;
        }
        session.lastActiveAt = new Date().toISOString();
        return session;
    }
    const newSession: ConversationSession = {
        id: generateId(), userId, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), messages: [], context: {},
    };
    sessions.set(newSession.id, newSession);
    return newSession;
}

export function updateSession(
    sessionId: string,
    userMessage: string,
    assistantResponse: string,
    intent: ParsedIntent,
    metrics?: Record<string, any>,
    recommendations?: { title: string; resourceId?: string; savings?: string }[]
): void {
    const session = sessions.get(sessionId);
    if (!session) return;

    session.messages.push({ role: "user", content: userMessage, timestamp: new Date().toISOString() });
    session.messages.push({ role: "assistant", content: assistantResponse, timestamp: new Date().toISOString() });

    // Keep last 12 messages (6 turns) — enough for follow-up resolution
    if (session.messages.length > 12) session.messages = session.messages.slice(-12);

    // Update basic context
    session.context.lastIntent = intent;
    session.context.lastMetrics = metrics;
    session.context.preferredTimeRange = intent.timeRange;

    // Track discussed resources from entities + response text
    const discussed = session.context.discussedResources || [];
    const entities = intent.extractedEntities;
    if (entities) {
        for (const id of entities.instanceIds || []) discussed.push({ id, type: "ec2" });
        for (const name of entities.functionNames || []) discussed.push({ id: name, type: "lambda" });
        for (const name of entities.bucketNames || []) discussed.push({ id: name, type: "s3" });
        for (const id of entities.dbIdentifiers || []) discussed.push({ id, type: "rds" });
        for (const name of entities.clusterNames || []) discussed.push({ id: name, type: "ecs" });
    }
    // Also extract resource IDs from the response text
    for (const resId of extractResourceIds(assistantResponse)) {
        if (!discussed.find(d => d.id === resId)) {
            discussed.push({ id: resId, type: "unknown" });
        }
    }
    // Dedup and keep last 20
    const seen = new Set<string>();
    session.context.discussedResources = discussed.filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
    }).slice(-20);

    // Track active recommendations
    if (recommendations && recommendations.length > 0) {
        session.context.activeRecommendations = recommendations.slice(0, 10);
    }

    // Build conversation summary (compress older messages)
    if (session.messages.length >= 8) {
        const older = session.messages.slice(0, -4);
        session.context.conversationSummary = older.map(m =>
            `${m.role === "user" ? "Q" : "A"}: ${m.content.slice(0, 120)}`
        ).join(" | ");
    }

    session.lastActiveAt = new Date().toISOString();
}

export function formatHistory(messages: ChatMessage[], context?: SessionContext): string {
    if (!messages.length && !context?.conversationSummary) return "No previous messages.";

    let history = "";

    // Include compressed summary of older messages
    if (context?.conversationSummary) {
        history += `[Earlier in conversation: ${context.conversationSummary}]\n\n`;
    }

    // Include recent messages in full (last 6)
    const recent = messages.slice(-6);
    history += recent.map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 300)}`).join("\n");

    // Include discussed resources if any
    if (context?.discussedResources && context.discussedResources.length > 0) {
        history += `\n\n[Previously discussed resources: ${context.discussedResources.map(r => `${r.type}:${r.id}`).join(", ")}]`;
    }

    return history;
}

// Periodic cleanup
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now - new Date(session.lastActiveAt).getTime() > SESSION_TTL) sessions.delete(id);
    }
}, 5 * 60 * 1000);


