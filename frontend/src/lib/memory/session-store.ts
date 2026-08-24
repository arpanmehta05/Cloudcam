// Session Store - In-memory conversation memory
// Stores chat history and context for multi-turn conversations

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    citations?: string[];
}

export interface SessionContext {
    lastIntent?: ParsedIntent;
    lastMetrics?: Record<string, any>;
    lastRecommendations?: string[];
    preferredTimeRange?: string;
}

export interface ParsedIntent {
    intent: string;
    services: string[];
    dataSources: {
        metrics: boolean;
        logs: boolean;
        costExplorer: boolean;
    };
    timeRange: string;
    comparison?: {
        enabled: boolean;
        compareTo?: string;
    };
    isFollowUp: boolean;
    extractedEntities?: {
        instanceIds?: string[];
        functionNames?: string[];
        specificTime?: string;
    };
    confidence?: number;
}

export interface ConversationSession {
    id: string;
    createdAt: string;
    lastActiveAt: string;
    messages: ChatMessage[];
    context: SessionContext;
}

// In-memory session store
const sessions = new Map<string, ConversationSession>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

// Generate UUID (simple version for browser/node compatibility)
function generateId(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Get existing session or create new one
export function getOrCreateSession(sessionId?: string): ConversationSession {
    // Try to get existing session
    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        session.lastActiveAt = new Date().toISOString();
        return session;
    }

    // Create new session
    const newSession: ConversationSession = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        messages: [],
        context: {},
    };

    sessions.set(newSession.id, newSession);
    return newSession;
}

// Update session with new message
export function updateSession(
    sessionId: string,
    userMessage: string,
    assistantResponse: string,
    intent: ParsedIntent,
    metrics?: Record<string, any>
): void {
    const session = sessions.get(sessionId);
    if (!session) return;

    // Add messages
    session.messages.push({
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
    });

    session.messages.push({
        role: "assistant",
        content: assistantResponse,
        timestamp: new Date().toISOString(),
    });

    // Keep only last 10 messages
    if (session.messages.length > 10) {
        session.messages = session.messages.slice(-10);
    }

    // Update context
    session.context.lastIntent = intent;
    session.context.lastMetrics = metrics;
    session.context.preferredTimeRange = intent.timeRange;
    session.lastActiveAt = new Date().toISOString();
}

// Get session
export function getSession(sessionId: string): ConversationSession | undefined {
    return sessions.get(sessionId);
}

// Format conversation history for classifier
export function formatHistory(messages: ChatMessage[]): string {
    if (!messages.length) return "No previous messages.";

    return messages
        .slice(-6) // Last 3 exchanges
        .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 200)}`)
        .join("\n");
}

// Cleanup expired sessions (call periodically)
export function cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        const lastActive = new Date(session.lastActiveAt).getTime();
        if (now - lastActive > SESSION_TTL) {
            sessions.delete(id);
        }
    }
}

// Start cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

export function startSessionCleanup(): void {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(cleanupExpiredSessions, 5 * 60 * 1000); // Every 5 minutes
}

export function stopSessionCleanup(): void {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}
