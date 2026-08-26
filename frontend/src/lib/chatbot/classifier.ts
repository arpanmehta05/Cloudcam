// Intent Classifier - Gemini Stage 1
// Classifies user intent and determines what data sources to query

export const CLASSIFIER_SYSTEM_PROMPT = `
You are an intent classifier for Cloudcam, an AWS monitoring and cost optimization system.
Your job is to understand what the user wants and determine what data to fetch.

AVAILABLE SERVICES:
- ec2: EC2 instances (CPU, network, status)
- lambda: Lambda functions (errors, invocations, duration)
- rds: RDS databases (CPU, connections, storage)
- s3: S3 buckets (size, object count)
- waf: WAF firewall (blocked/allowed requests)
- cloudfront: CloudFront CDN (requests, error rate)
- apigateway: API Gateway (requests, latency)
- amplify: Amplify hosting (requests, errors, latency, tokens)
- billing: AWS billing (total and per-service costs)

INTENT TYPES:
- billing_status: User wants to know current spending/costs
- cost_optimization: User wants to save money, reduce costs
- resource_health: User wants to check if systems are working
- debugging: User wants to investigate an error/failure
- anomaly_detection: User wants to find unusual patterns
- comparison: User wants to compare time periods
- general: General question about their infrastructure

DATA SOURCE RULES:
- logs: true ONLY if query mentions: error, fail, crash, issue, problem, debug, "why did X fail", investigate, exception, timeout
- logs: false for: billing, cost, optimize, save money, health check, status, utilization
- costExplorer: true if query mentions: bill, cost, spend, charges, expensive, save money, budget

TIME RANGE INTERPRETATION:
- "today" / "now" / "current" → "24h"
- "this week" / "past week" → "7d"
- "this month" / "month to date" → "30d"
- "yesterday" → "24h" (offset)
- "last hour" → "1h"
- specific time like "at 2pm" → "1h"
- If no time mentioned → "24h"

OUTPUT JSON ONLY. No other text.
`;

export const CLASSIFIER_USER_PROMPT = (message: string, history: string): string => `
CONVERSATION HISTORY:
${history}

CURRENT USER MESSAGE:
"${message}"

Analyze and return JSON:
{
  "intent": "billing_status|cost_optimization|resource_health|debugging|anomaly_detection|comparison|general",
  "services": ["service1", "service2"],
  "dataSources": {
    "metrics": true,
    "logs": boolean,
    "costExplorer": boolean
  },
  "timeRange": "1h|6h|24h|7d|30d",
  "comparison": {
    "enabled": boolean,
    "compareTo": "previous_period"
  },
  "isFollowUp": boolean,
  "extractedEntities": {
    "instanceIds": [],
    "functionNames": [],
    "specificTime": null
  }
}
`;

// Parse classifier response
export function parseClassifierResponse(responseText: string): import("@/lib/memory/session-store").ParsedIntent {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return getDefaultIntent();
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            intent: parsed.intent || "general",
            services: parsed.services || ["billing", "ec2"],
            dataSources: {
                metrics: true,
                logs: parsed.dataSources?.logs || false,
                costExplorer: parsed.dataSources?.costExplorer || false,
            },
            timeRange: parsed.timeRange || "24h",
            comparison: parsed.comparison,
            isFollowUp: parsed.isFollowUp || false,
            extractedEntities: parsed.extractedEntities,
        };
    } catch {
        return getDefaultIntent();
    }
}

function getDefaultIntent(): import("@/lib/memory/session-store").ParsedIntent {
    return {
        intent: "general",
        services: ["billing", "ec2", "lambda"],
        dataSources: {
            metrics: true,
            logs: false,
            costExplorer: true,
        },
        timeRange: "24h",
        isFollowUp: false,
    };
}
