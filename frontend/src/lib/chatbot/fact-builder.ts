// Fact Builder v2 (Direct AWS SDK Integration)
// Constructs a grounded fact sheet from native AWS data sources
// Replaces previous Prometheus-based RAG logic.

import { SERVICE_REGISTRY } from "@/lib/services/registry";
import { fetchMetrics, calculateMetricStats, CloudWatchMetricQuery } from "@/lib/aws/cloudwatch";
import { getMonthToDateCost, getCostForecast } from "@/lib/aws/cost-explorer";
import { getResourceInventory } from "@/lib/aws/resources";
import { getSecuritySummary } from "@/lib/aws/security";
import type { ParsedIntent } from "@/lib/memory/session-store";

export interface Fact {
    id: string;
    type: "metric" | "inventory" | "billing" | "security" | "calculated";
    content: string;
    source: string;
    value?: number;
    unit?: string;
}

export interface FactSheetResult {
    facts: Fact[];
    factSheet: string;
    rawData: Record<string, any>;
}

export async function buildFactSheet(intent: ParsedIntent, workspaceId: string): Promise<FactSheetResult> {
    const facts: Fact[] = [];
    const rawData: Record<string, any> = {};
    let factId = 1;

    const { services, timeRange, dataSources } = intent;
    const timestamp = new Date().toISOString();

    // ═══════════════════════════════════════════════════════════════════
    // RESOURCE DISCOVERY (Inventory)
    // ═══════════════════════════════════════════════════════════════════
    try {
        const inventory = await getResourceInventory(workspaceId);
        rawData["inventory"] = inventory;

        facts.push({
            id: `FACT-${factId++}`,
            type: "inventory",
            content: `Infrastructure Scan: Discovered ${inventory.counts.total} total active resources (${inventory.counts.ec2} EC2, ${inventory.counts.lambda} Lambda, ${inventory.counts.rds} RDS, ${inventory.counts.s3} S3).`,
            source: "AWS SDK Resource Discovery",
            value: inventory.counts.total,
            unit: "resources"
        });

        // Add specific inventory facts for requested services
        services.forEach(svc => {
            const count = inventory.counts[svc];
            if (count > 0) {
                facts.push({
                    id: `FACT-${factId++}`,
                    type: "inventory",
                    content: `Service Context: There are ${count} active ${svc.toUpperCase()} resources currently running in the account.`,
                    source: `Describe${svc.charAt(0).toUpperCase() + svc.slice(1)} API`
                });
            }
        });
    } catch (error) {
        console.error("FactBuilder: Error fetching inventory:", error);
    }

    // ═══════════════════════════════════════════════════════════════════
    // CLOUDWATCH METRICS
    // ═══════════════════════════════════════════════════════════════════
    const servicesToQuery = new Set(services);
    // Auto-include core if intent is health or optimization
    if (intent.intent === "cost_optimization" || intent.intent === "resource_health") {
        servicesToQuery.add("ec2");
        servicesToQuery.add("lambda");
    }

    for (const serviceName of Array.from(servicesToQuery)) {
        const service = SERVICE_REGISTRY[serviceName];
        if (!service) continue;

        const queries: CloudWatchMetricQuery[] = service.metrics.map(m => ({
            namespace: m.namespace,
            metricName: m.metricName,
            stat: m.stat,
            period: m.period,
            dimensions: []
        }));

        try {
            const results = await fetchMetrics(workspaceId, queries, timeRange);

            results.forEach((series, idx) => {
                const metricDef = service.metrics[idx];
                const stats = calculateMetricStats(series.datapoints);

                rawData[`${serviceName}_${metricDef.name}`] = stats;

                facts.push({
                    id: `FACT-${factId++}`,
                    type: "metric",
                    content: `${service.displayName} ${metricDef.name} telemetry: current reading is ${stats.current.toFixed(1)}${metricDef.unit}, with a ${timeRange} average of ${stats.avg.toFixed(1)}${metricDef.unit} (Max: ${stats.max.toFixed(1)}${metricDef.unit}).`,
                    source: `CloudWatch ${metricDef.namespace}/${metricDef.metricName}`,
                    value: stats.current,
                    unit: metricDef.unit
                });
            });
        } catch (error) {
            console.error(`FactBuilder: Error fetching metrics for ${serviceName}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // BILLING & COST EXPLORER
    // ═══════════════════════════════════════════════════════════════════
    if (dataSources.costExplorer || services.includes("cost") || intent.intent === "cost_optimization") {
        try {
            const mtdCost = await getMonthToDateCost(workspaceId);
            const forecast = await getCostForecast(workspaceId);

            rawData["billing"] = { mtd: mtdCost, forecast };

            facts.push({
                id: `FACT-${factId++}`,
                type: "billing",
                content: `Total Month-to-Date Spend: $${mtdCost.total.toFixed(2)} USD (covering ${mtdCost.period.start} to ${mtdCost.period.end}).`,
                source: "AWS Cost Explorer (MTD)",
                value: mtdCost.total,
                unit: "USD"
            });

            if (forecast) {
                const projectedTotal = mtdCost.total + forecast.amount;
                facts.push({
                    id: `FACT-${factId++}`,
                    type: "billing",
                    content: `Cost Forecast: Projected end-of-month spend is ~$${projectedTotal.toFixed(2)} USD based on current usage patterns.`,
                    source: "AWS Cost Explorer (Forecast)",
                    value: projectedTotal,
                    unit: "USD"
                });
            }

            // Top services by cost
            mtdCost.breakdown.slice(0, 3).forEach(item => {
                facts.push({
                    id: `FACT-${factId++}`,
                    type: "billing",
                    content: `Cost Driver: ${item.service} accounts for $${item.amount.toFixed(2)} of current spending.`,
                    source: "AWS Cost Explorer"
                });
            });
        } catch (error) {
            console.error("FactBuilder: Error fetching billing:", error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // SECURITY FINDINGS
    // ═══════════════════════════════════════════════════════════════════
    if (services.includes("security") || intent.intent === "resource_health") {
        try {
            const security = await getSecuritySummary(workspaceId);
            rawData["security"] = security;

            if (security.threats.count > 0) {
                facts.push({
                    id: `FACT-${factId++}`,
                    type: "security",
                    content: `Security Alert: There are ${security.threats.count} active GuardDuty threats detected in the account. Highest severity identified is ${security.threats.maxSeverity.toFixed(1)}.`,
                    source: "AWS GuardDuty Findings",
                    value: security.threats.count
                });
            } else {
                facts.push({
                    id: `FACT-${factId++}`,
                    type: "security",
                    content: "Security Status: No active GuardDuty threats found in the current region.",
                    source: "AWS GuardDuty"
                });
            }

            if (security.compliance.highRiskFindings > 0) {
                facts.push({
                    id: `FACT-${factId++}`,
                    type: "security",
                    content: `Security Compliance: SecurityHub reported ${security.compliance.highRiskFindings} HIGH or CRITICAL findings that require immediate attention.`,
                    source: "AWS SecurityHub",
                    value: security.compliance.highRiskFindings
                });
            }
        } catch (error) {
            console.error("FactBuilder: Error fetching security summary:", error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // FORMAT FINAL FACT SHEET
    // ═══════════════════════════════════════════════════════════════════
    const factSheet = facts
        .map(f => `[${f.id}] ${f.content} | Source: ${f.source}`)
        .join("\n");

    return { facts, factSheet, rawData };
}

// Format logic for chatbot remains constant to support existing LLM prompting
export function validateCitations(
    responseCitations: string[],
    availableFacts: Fact[]
): { valid: boolean; missing: string[]; found: string[] } {
    const availableIds = new Set(availableFacts.map(f => f.id));
    const found: string[] = [];
    const missing: string[] = [];

    for (const cite of responseCitations) {
        const normalized = cite.toUpperCase().replace(/[\[\]]/g, "").trim();
        if (availableIds.has(normalized) || availableIds.has(`FACT-${normalized.replace("FACT-", "")}`)) {
            found.push(normalized);
        } else {
            missing.push(cite);
        }
    }
    return { valid: missing.length === 0, missing, found };
}

export function extractCitations(text: string): string[] {
    const matches = text.match(/\[FACT-\d+\]/gi) || [];
    return [...new Set(matches.map(m => m.toUpperCase()))];
}
