// ─── Chat Models ───

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
  /** Resource IDs discussed in this session (for follow-up resolution) */
  discussedResources?: { id: string; type: string; name?: string }[];
  /** Active recommendations from the last response */
  activeRecommendations?: {
    title: string;
    resourceId?: string;
    savings?: string;
  }[];
  /** Compressed summary of the conversation so far */
  conversationSummary?: string;
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
    bucketNames?: string[];
    dbIdentifiers?: string[];
    clusterNames?: string[];
    specificTime?: string;
  };
  confidence?: number;
  clarificationQuestion?: string;
}

export interface ConversationSession {
  id: string;
  userId?: string;
  createdAt: string;
  lastActiveAt: string;
  messages: ChatMessage[];
  context: SessionContext;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
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
      billing?: { total?: number; byService?: Record<string, number> };
      recommendations?: Recommendation[];
      anomalies?: Anomaly[];
      health?: ServiceHealth[];
    };
    followUp: string[];
  };
  evidence: Evidence[];
  metadata: {
    intent: string;
    services: string[];
    stage1Time: number;
    stage2Time: number;
    totalTime: number;
  };
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
export function generateFollowUps(
  intent: string,
  services: string[],
): string[] {
  const suggestions: string[] = [];
  switch (intent) {
    case "billing_status":
      suggestions.push(
        "How can I reduce my costs?",
        "Show me Lambda usage",
        "Compare to last month",
      );
      break;
    case "cost_optimization":
      suggestions.push(
        "What about RDS optimization?",
        "Show me S3 storage usage",
        "Any Lambda inefficiencies?",
      );
      break;
    case "resource_health":
      suggestions.push(
        "Any errors in Lambda?",
        "Show me EC2 performance",
        "Check API latency",
      );
      break;
    case "debugging":
      suggestions.push(
        "Show me overall health",
        "Any cost impact?",
        "Check other services",
      );
      break;
    case "infrastructure_action":
      suggestions.push(
        "What resources are idle?",
        "Show me the savings from actions",
        "Can you stop unused instances?",
      );
      break;
    case "security_audit":
      suggestions.push(
        "Are any ports open to the internet?",
        "Check encryption status",
        "Any compliance issues?",
      );
      break;
    case "performance_tuning":
      suggestions.push(
        "Which Lambda functions are slowest?",
        "Is my database connection pooling optimal?",
        "How's my CloudFront cache hit ratio?",
      );
      break;
    case "architecture_review":
      suggestions.push(
        "Is my infrastructure highly available?",
        "What modernization opportunities exist?",
        "Rate my security posture",
      );
      break;
    case "compliance_check":
      suggestions.push(
        "Is encryption enabled everywhere?",
        "Are all resources tagged properly?",
        "Is CloudTrail logging enabled?",
      );
      break;
    case "capacity_planning":
      suggestions.push(
        "Which services are closest to capacity?",
        "How much would scaling cost?",
        "Is auto-scaling configured correctly?",
      );
      break;
    case "product_help":
      suggestions.push(
        "How do I use simulations?",
        "How do I send AI traces?",
        "Why is AI Observability empty?",
      );
      break;
    default:
      suggestions.push(
        "What's my current billing?",
        "How do simulations work?",
        "How do I set up AI Observability?",
      );
  }
  return suggestions.slice(0, 3);
}
