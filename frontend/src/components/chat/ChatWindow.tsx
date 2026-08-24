"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Send,
    Loader2,
    MessageSquare,
    X,
    ChevronDown,
    Sparkles,
    Info,
    Play,
    AlertTriangle,
    Shield,
    Zap,
} from "@/icons";
import { authFetchJson } from "@/lib/auth-fetch";
import type { ChatMessage, ChatResponse, Evidence, ActionPlan, Recommendation, Anomaly, ServiceHealth, SecurityFinding, PerformanceTuning } from "@/types/chat";
import { ActionPreviewDrawer } from "@/components/ActionPreviewDrawer";
import { ChatResponseSchema } from "@/lib/schemas/chat";

interface ChatWindowProps {
    isOpen: boolean;
    onClose: () => void;
}

function stripFactCitations(content: string): string {
    return content
        .replace(/\[\s*fact\s*[- ]?\s*\d+(?:\s*,\s*(?:fact\s*[- ]?)?\s*\d+)*\s*\]/gi, "")
        .replace(/\[\s*fact\s*[- ]?\s*[a-z0-9]+\s*\]/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

export function ChatWindow({ isOpen, onClose }: ChatWindowProps) {
    const pathname = usePathname();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showEvidence, setShowEvidence] = useState<string | null>(null);
    const [actionPlans, setActionPlans] = useState<Record<string, ActionPlan[]>>({});
    const [executingAction, setExecutingAction] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isDocsRoute = pathname === "/docs" || pathname.startsWith("/docs/");
    const starterQuestions = isDocsRoute
        ? [
            "What is on this docs page?",
            "How do I connect AWS?",
            "Why can billing show zero?",
            "How do simulations work?",
            "What should I check if dashboards are empty?",
        ]
        : [
            "What's my current billing?",
            "How's my infrastructure health?",
            "Any optimization opportunities?",
            "Stop idle EC2 instances",
            "Run a security audit",
        ];

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        // Add loading message
        const loadingId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, {
            id: loadingId,
            role: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
            isLoading: true,
        }]);

        try {
            const data = await authFetchJson("/api/chat", ChatResponseSchema, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage.content,
                    sessionId,
                }),
            });

            // Update session ID
            if (data.sessionId) {
                setSessionId(data.sessionId);
            }

            // Replace loading message with actual response
            const assistantMessage: ChatMessage = {
                id: loadingId,
                role: "assistant",
                content: data.success ? data.response.summary : "Sorry, I couldn't process that request.",
                timestamp: new Date().toISOString(),
                isLoading: false,
                evidence: data.evidence,
                followUp: data.response?.followUp,
                details: data.response?.details,
                metadata: data.metadata,
            };

            setMessages(prev => prev.map(m => m.id === loadingId ? assistantMessage : m));

            // Store action plans if present
            if (data.response?.actionPlans && data.response.actionPlans.length > 0) {
                setActionPlans(prev => ({ ...prev, [loadingId]: data.response.actionPlans! }));
            }

        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => prev.map(m =>
                m.id === loadingId
                    ? { ...m, content: "Failed to connect to the chat service.", isLoading: false }
                    : m
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleFollowUp = (question: string) => {
        setInput(question);
        inputRef.current?.focus();
    };

    const handlePreviewAction = (plan: ActionPlan) => {
        setSelectedPlan(plan);
        setDrawerOpen(true);
    };

    const handleActionComplete = (result: any) => {
        const status = result.status === "simulated" ? "simulated" : "completed";
        const resultMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "assistant",
            content: status === "simulated"
                ? `🛡️ Simulation complete for "${result.displayName || result.actionId}". No real changes were made.\n\nStatus: ${result.status} · ID: ${result._id}`
                : `✅ Action "${result.displayName || result.actionId}" executed successfully.\n\nStatus: ${result.status} · ID: ${result._id}`,
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, resultMsg]);
    };

    const riskColors: Record<string, string> = {
        low: "bg-emerald-100 text-emerald-700",
        medium: "bg-amber-100 text-amber-700",
        high: "bg-orange-100 text-orange-700",
        critical: "bg-red-100 text-red-700",
    };

    return (
        <div
            className="w-full max-w-[420px] min-w-[320px] h-full min-h-0 bg-card border-l rounded-l-xl overflow-hidden flex flex-col"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-foreground" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground tracking-tight">Ask AI</h3>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Cloud Intelligence</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all rounded-lg"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 h-full">
                <div className="space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center py-8">
                            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground mb-3">
                                {isDocsRoute ? "Ask about CloudWatcher docs" : "Ask about your AWS infrastructure"}
                            </p>
                            <div className="space-y-2">
                                {starterQuestions.map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => handleFollowUp(q)}
                                        className="block w-full text-left px-3 py-2 text-xs text-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-lg px-3 py-2 ${message.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-foreground"
                                        }`}
                                >
                                    {message.isLoading ? (
                                        <div className="flex items-center gap-2 py-1">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span className="text-xs">Analyzing...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {stripFactCitations(message.content)}
                                            </p>

                                            {message.metadata?.grounding && (
                                                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span className={`px-1.5 py-0.5 rounded ${message.metadata.grounding.degraded ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                        Grounding {Math.round(message.metadata.grounding.score * 100)}%
                                                    </span>
                                                    {!message.metadata.dataQuality?.complete && (
                                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                                            Partial data
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Structured Details Panels */}
                                            {message.details?.recommendations && message.details.recommendations.length > 0 && (
                                                <div className="mt-2 space-y-1.5">
                                                    <div className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                                                        <Sparkles className="w-3 h-3" /> Recommendations
                                                    </div>
                                                    {message.details.recommendations.map((rec, i) => (
                                                        <div key={i} className="bg-emerald-50 rounded-md px-2.5 py-1.5 border border-emerald-100">
                                                            <p className="text-xs font-medium text-emerald-900">{rec.title}</p>
                                                            <p className="text-[11px] text-emerald-700 mt-0.5">{rec.description}</p>
                                                            {rec.savings && <p className="text-[10px] font-medium text-emerald-600 mt-0.5">Savings: {rec.savings}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {message.details?.anomalies && message.details.anomalies.length > 0 && (
                                                <div className="mt-2 space-y-1.5">
                                                    <div className="flex items-center gap-1 text-xs font-medium text-amber-700">
                                                        <AlertTriangle className="w-3 h-3" /> Anomalies
                                                    </div>
                                                    {message.details.anomalies.map((anomaly, i) => (
                                                        <div key={i} className={`rounded-md px-2.5 py-1.5 border ${anomaly.severity === "critical" ? "bg-red-50 border-red-100" : anomaly.severity === "warning" ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
                                                            <p className="text-xs font-medium">{anomaly.type}</p>
                                                            <p className="text-[11px] mt-0.5">{anomaly.description}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {message.details?.health && message.details.health.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                                                        <Info className="w-3 h-3" /> Service Health
                                                    </div>
                                                    {message.details.health.map((svc, i) => (
                                                        <div key={i} className="flex items-center gap-2 text-[11px]">
                                                            <span className={`w-2 h-2 rounded-full ${svc.status === "healthy" ? "bg-emerald-500" : svc.status === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
                                                            <span className="font-medium">{svc.name}</span>
                                                            <span className="text-muted-foreground">{svc.reason}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {message.details?.securityFindings && message.details.securityFindings.length > 0 && (
                                                <div className="mt-2 space-y-1.5">
                                                    <div className="flex items-center gap-1 text-xs font-medium text-red-700">
                                                        <Shield className="w-3 h-3" /> Security Findings
                                                    </div>
                                                    {message.details.securityFindings.map((finding, i) => (
                                                        <div key={i} className={`rounded-md px-2.5 py-1.5 border ${finding.severity === "critical" || finding.severity === "high" ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-[10px] font-bold uppercase ${finding.severity === "critical" ? "text-red-600" : finding.severity === "high" ? "text-orange-600" : "text-amber-600"}`}>{finding.severity}</span>
                                                                <p className="text-xs font-medium">{finding.title}</p>
                                                            </div>
                                                            <p className="text-[11px] mt-0.5">{finding.description}</p>
                                                            {finding.remediation && <p className="text-[10px] text-muted-foreground mt-0.5">Fix: {finding.remediation}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Evidence toggle */}
                                            {message.evidence && message.evidence.length > 0 && (
                                                <button
                                                    onClick={() => setShowEvidence(
                                                        showEvidence === message.id ? null : message.id
                                                    )}
                                                    className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground"
                                                >
                                                    <Info className="w-3 h-3" />
                                                    {showEvidence === message.id ? "Hide" : "Show"} sources ({message.evidence.length})
                                                    <ChevronDown className={`w-3 h-3 transition-transform ${showEvidence === message.id ? "rotate-180" : ""
                                                        }`} />
                                                </button>
                                            )}

                                            {/* Evidence panel */}
                                            {showEvidence === message.id && message.evidence && (
                                                <div className="mt-2 pt-2 border-t border-border">
                                                    {message.evidence.map((e) => (
                                                        <div key={e.factId} className="text-xs text-muted-foreground mb-1">
                                                            <span className="font-mono text-muted-foreground/60">[{e.factId}]</span>{" "}
                                                            {e.content.slice(0, 100)}...
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Follow-up suggestions */}
                                            {message.followUp && message.followUp.length > 0 && (
                                                <div className="mt-3 pt-2 border-t border-border space-y-1">
                                                    {message.followUp.map((q) => (
                                                        <button
                                                            key={q}
                                                            onClick={() => handleFollowUp(q)}
                                                            className="block text-xs text-muted-foreground hover:text-foreground hover:underline text-left"
                                                        >
                                                            → {q}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Action Plans */}
                                            {actionPlans[message.id] && actionPlans[message.id].length > 0 && (
                                                <div className="mt-3 pt-2 border-t border-border space-y-2">
                                                    <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                                                        <Zap className="w-3 h-3" />
                                                        Suggested Actions
                                                    </div>
                                                    {actionPlans[message.id].map((plan, idx) => (
                                                        <div key={idx} className="bg-card rounded-md border p-2.5 space-y-1.5">
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="text-xs font-medium text-foreground">{plan.actionId}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${riskColors[plan.riskLevel] || "bg-secondary text-muted-foreground"}`}>
                                                                    {plan.riskLevel}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground">{plan.reasoning}</p>
                                                            {plan.targets.length > 0 && (
                                                                <div className="text-[10px] text-muted-foreground/70">
                                                                    Targets: {plan.targets.map(t => t.resourceName || t.resourceId).join(", ")}
                                                                </div>
                                                            )}
                                                            {plan.warnings.length > 0 && (
                                                                <div className="flex items-start gap-1 text-[10px] text-amber-600">
                                                                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                                                    <span>{plan.warnings.join("; ")}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center justify-between pt-1">
                                                                {plan.estimatedSavings > 0 && (
                                                                    <span className="text-[10px] font-medium text-emerald-600">
                                                                        ~${plan.estimatedSavings.toFixed(2)}/mo savings
                                                                    </span>
                                                                )}
                                                                <button
                                                                    onClick={() => handlePreviewAction(plan)}
                                                                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                                                                >
                                                                    <Zap className="w-3 h-3" />
                                                                    Preview & Execute
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    <div ref={messagesEndRef} />
                </div>
                    </div>
            </ScrollArea>

            {/* Action Preview Drawer */}
            {selectedPlan && (
                <ActionPreviewDrawer
                    isOpen={drawerOpen}
                    onClose={() => { setDrawerOpen(false); setSelectedPlan(null); }}
                    actionId={selectedPlan.actionId}
                    targets={selectedPlan.targets}
                    estimatedSavings={selectedPlan.estimatedSavings}
                    reasoning={selectedPlan.reasoning}
                    onActionComplete={handleActionComplete}
                />
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t shrink-0 bg-card">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isDocsRoute ? "Ask about these docs..." : "Ask about billing, health, costs..."}
                        className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        disabled={isLoading}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading || !input.trim()}
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
