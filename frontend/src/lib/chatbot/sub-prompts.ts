// Sub-Prompts - Focused prompts for Stage 2
// Each prompt tackles one specific task for reliable output

export interface SubPromptConfig {
  trigger: string[];
  prompt: string;
}

export const SUB_PROMPTS: Record<string, SubPromptConfig> = {
  // ─────────────────────────────────────────────────────────────────────
  // BILLING SUMMARY
  // ─────────────────────────────────────────────────────────────────────
  billing_summary: {
    trigger: ["billing_status", "cost_optimization"],
    prompt: `You are a FinOps analyst. Summarize the billing data.

RULES:
1. Use ONLY the FACTS provided below. Do NOT invent numbers.
2. Cite facts using [FACT-X] notation in your response.
3. Include: total spend, any notable per-service costs.
4. If spend increased significantly, mention it.
5. Keep response to 2-3 sentences.

OUTPUT FORMAT:
{
  "content": "Your summary with [FACT-X] citations",
  "citations": ["FACT-1", "FACT-3"]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────
  // ANOMALY DETECTION
  // ─────────────────────────────────────────────────────────────────────
  anomaly_detection: {
    trigger: ["anomaly_detection", "billing_status", "resource_health"],
    prompt: `You are a cloud monitoring expert. Identify anomalies in the data.

ANOMALY CRITERIA:
- CPU > 80% sustained → performance concern
- CPU < 10% sustained → waste (underutilization)
- Error rate > 5% → reliability issue
- Billing increase > 20% vs expected → cost anomaly
- Status check failed → critical health issue
- Latency > 1000ms → performance degradation

RULES:
1. Only report anomalies if FACTS support them with actual numbers.
2. Cite the specific FACT for each anomaly found.
3. Rate severity: "critical" (must fix now), "warning" (investigate), "info" (monitor).
4. If no anomalies found, say so clearly.

OUTPUT FORMAT:
{
  "content": "Description of anomalies found with [FACT-X] citations",
  "anomalies": [
    {"type": "cpu_high", "severity": "warning", "fact": "FACT-2"}
  ],
  "citations": ["FACT-2"]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────
  // OPTIMIZATION RECOMMENDATIONS
  // ─────────────────────────────────────────────────────────────────────
  optimization: {
    trigger: ["cost_optimization", "resource_health"],
    prompt: `You are an AWS cost optimization specialist providing actionable recommendations.

OPTIMIZATION RULES (apply only if FACTS support with real numbers):
- EC2 CPU < 20% → Right-size: save 40-50% of instance cost
- EC2 CPU > 80% → Consider auto-scaling to handle load
- Lambda errors > 5% of invocations → Fix code to reduce wasted invocations
- Lambda duration > 3s avg → Optimize function for faster execution
- RDS connections = 0 → Stop instance if unused: save 100%
- RDS CPU < 10% → Consider smaller instance: save 40%
- S3 > 100GB → Consider lifecycle policies/Glacier: save up to 70%

RULES:
1. DO NOT use generic savings like "$X/month" unless a FACT supports it (e.g. [FACT-5]).
2. If CALCULATED_SAVINGS facts exist, use those exact values.
3. If no specific usage metrics (CPU, errors) derived facts exist, but Billing facts show HIGH COST (> $100) for a service, recommend: "Investigate utilization for potential right-sizing."
4. Each recommendation must cite the metric fact that triggered it.
5. Be specific about the recommended action.

OUTPUT FORMAT:
{
  "content": "Summary statement (e.g. 'Found 2 optimization opportunities' or 'No optimizations detected')",
  "recommendations": [
    {
      "title": "Right-size EC2 instances",
      "description": "Instance showing 15% avg CPU [FACT-2]",
      "savings": "40-50% of EC2 costs",
      "action": "Consider downsizing to t3.small",
      "fact": "FACT-2"
    }
  ],
  "citations": ["FACT-2"]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────
  // DEBUGGING / ROOT CAUSE ANALYSIS
  // ─────────────────────────────────────────────────────────────────────
  debugging: {
    trigger: ["debugging"],
    prompt: `You are an AWS DevOps engineer investigating an issue.

INVESTIGATION APPROACH:
1. Check error logs for exceptions (OutOfMemoryError, Timeout, etc.)
2. Check metrics for resource exhaustion (CPU 100%, connections maxed)
3. Check timeline: correlate events
4. Identify root cause and provide remediation steps

COMMON PATTERNS:
- OutOfMemoryError → Lambda/container memory limit hit
- Timeout → Backend slow or unreachable
- Connection refused → Target health issues
- 5xx errors → Backend failures in logs

RULES:
1. ONLY use LOG facts and METRIC facts provided.
2. Cite every claim with the specific fact.
3. If no clear root cause, say "Unable to determine root cause from available data."

OUTPUT FORMAT:
{
  "content": "Root cause analysis with [FACT-X] citations",
  "rootCause": "Brief description",
  "evidence": ["FACT-3", "FACT-5"],
  "remediation": "Suggested fix",
  "citations": ["FACT-3", "FACT-5"]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────────────────────────────
  health_check: {
    trigger: ["resource_health"],
    prompt: `You are a site reliability engineer providing a health summary.

HEALTH STATUS CRITERIA:
- ✅ healthy: All targets UP, error rate < 1%, CPU 20-80%
- ⚠️ warning: Some degradation (error rate 1-5%, CPU > 80% or < 10%)
- ❌ critical: System down, status check failed, error rate > 5%

RULES:
1. For each service with FACTS available, report health status.
2. Cite the metric that determines each status.
3. Be concise - one line per service.

OUTPUT FORMAT:
{
  "content": "Health summary with [FACT-X] citations",
  "services": [
    {"name": "EC2", "status": "healthy", "reason": "CPU at 45% [FACT-1]"}
  ],
  "citations": ["FACT-1"]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────
  // COMPARISON
  // ─────────────────────────────────────────────────────────────────────
  comparison: {
    trigger: ["comparison"],
    prompt: `You are a data analyst comparing metrics across time periods.

RULES:
1. Compare current vs previous period metrics from FACTS.
2. Calculate percentage change: ((new - old) / old) * 100
3. Highlight significant changes (>20% change).
4. Cite both current and comparison FACTS.

OUTPUT FORMAT:
{
  "content": "Comparison summary with [FACT-X] citations",
  "changes": [
    {"metric": "CPU", "current": 45, "previous": 30, "change": "+50%", "significant": true}
  ],
  "citations": ["FACT-1", "FACT-2"]
}`,
  },
};

// Select which prompts to run based on intent
export function selectPrompts(intent: string): string[] {
  const prompts: string[] = [];

  for (const [key, config] of Object.entries(SUB_PROMPTS)) {
    if (config.trigger.includes(intent)) {
      prompts.push(key);
    }
  }

  // Always include at least one prompt
  if (prompts.length === 0) {
    prompts.push("health_check");
  }

  return prompts;
}
