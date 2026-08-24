// Chat Types - TypeScript interfaces for the chatbot

export interface ChatRequest {
    message: string;
    sessionId?: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    isLoading?: boolean;
    evidence?: Evidence[];
    followUp?: string[];
    details?: ChatResponse["response"]["details"];
    metadata?: ChatResponse["metadata"];
}

export interface Evidence {
    factId: string;
    content: string;
    source: string;
    value?: number;
    unit?: string;
}

export interface ChatResponse {
    success: boolean;
    sessionId: string;
    response: {
        summary: string;
        details?: {
            billing?: {
                total?: number;
                byService?: Record<string, number>;
            };
            recommendations?: Recommendation[];
            anomalies?: Anomaly[];
            health?: ServiceHealth[];
            actionIntent?: ActionIntent;
            securityFindings?: SecurityFinding[];
            performanceTuning?: PerformanceTuning[];
            architectureReview?: Record<string, { score: string; notes: string }>;
            complianceChecks?: ComplianceCheck[];
            capacityPlanning?: any[];
        };
        followUp: string[];
        actionPlans?: ActionPlan[];
    };
    evidence: Evidence[];
    metadata: {
        intent: string;
        services: string[];
        stage1Time: number;
        stage2Time: number;
        totalTime: number;
        classifierConfidence?: number;
        needsClarification?: boolean;
        grounding?: {
            score: number;
            threshold: number;
            totalCitations: number;
            validCitations: number;
            missingCitations?: string[];
            degraded: boolean;
        };
        retrieval?: {
            totalFacts: number;
            selectedFacts: number;
            factSheetChars: number;
            budgetChars: number;
        };
        dataQuality?: {
            fetchedAt: string;
            complete: boolean;
            sourceStatuses: Record<string, unknown>;
            failedSources?: string[];
        };
    };
}

export interface ActionIntent {
    actionId: string;
    targets: { resourceId: string; resourceName: string; region: string }[];
    estimatedSavings: number;
    reasoning: string;
    warnings: string[];
}

export interface ActionPlan {
    actionId: string;
    targets: { resourceId: string; resourceName: string; region: string }[];
    estimatedSavings: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    reasoning: string;
    warnings: string[];
}

export interface SecurityFinding {
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    remediation: string;
}

export interface PerformanceTuning {
    area: string;
    issue: string;
    current: string;
    recommendation: string;
    expectedImprovement: string;
}

export interface ComplianceCheck {
    area: string;
    check: string;
    status: "pass" | "fail" | "unknown";
    detail: string;
}

export interface Recommendation {
    title: string;
    description: string;
    savings?: string;
    action: string;
    factId: string;
}

export interface Anomaly {
    type: string;
    severity: "critical" | "warning" | "info";
    description: string;
    factId: string;
}

export interface ServiceHealth {
    name: string;
    status: "healthy" | "warning" | "critical";
    reason: string;
}

// Follow-up suggestions based on intent
export function generateFollowUps(intent: string, services: string[]): string[] {
    const suggestions: string[] = [];

    switch (intent) {
        case "billing_status":
            suggestions.push(
                "How can I reduce my costs?",
                "Show me Lambda usage",
                "Compare to last month"
            );
            break;
        case "cost_optimization":
            suggestions.push(
                "What about RDS optimization?",
                "Show me S3 storage usage",
                "Any Lambda inefficiencies?"
            );
            break;
        case "resource_health":
            suggestions.push(
                "Any errors in Lambda?",
                "Show me EC2 performance",
                "Check API latency"
            );
            break;
        case "debugging":
            suggestions.push(
                "Show me overall health",
                "Any cost impact?",
                "Check other services"
            );
            break;
        case "infrastructure_action":
            suggestions.push(
                "What resources are idle?",
                "Show me the savings from actions",
                "Can you stop unused instances?"
            );
            break;
        case "security_audit":
            suggestions.push(
                "Are any ports open to the internet?",
                "Check encryption status",
                "Any compliance issues?"
            );
            break;
        case "capacity_planning":
            suggestions.push(
                "Which services are closest to capacity?",
                "How much would scaling cost?",
                "Is auto-scaling configured correctly?"
            );
            break;
        case "performance_tuning":
            suggestions.push(
                "Which Lambda functions are slowest?",
                "Is my database connection pooling optimal?",
                "How's my CloudFront cache hit ratio?"
            );
            break;
        case "architecture_review":
            suggestions.push(
                "Is my infrastructure highly available?",
                "What modernization opportunities exist?",
                "Rate my security posture"
            );
            break;
        case "compliance_check":
            suggestions.push(
                "Is encryption enabled everywhere?",
                "Are all resources tagged properly?",
                "Is CloudTrail logging enabled?"
            );
            break;
        case "product_help":
            suggestions.push(
                "How do I use simulations?",
                "How do I send AI traces?",
                "Why is AI Observability empty?"
            );
            break;
        default:
            suggestions.push(
                "What's my current billing?",
                "How do simulations work?",
                "How do I set up AI Observability?"
            );
    }

    return suggestions.slice(0, 3);
}
