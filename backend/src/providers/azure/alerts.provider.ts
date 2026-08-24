import axios from "axios";
import { getAzureAccessToken } from "./client-factory";

export interface AzureAlertParams {
    name: string;
    metric: string;
    threshold: number;
    comparison: string; // e.g. GreaterThan, GreaterThanOrEqual, LessThan, LessThanOrEqual
    period: number; // e.g. 60, 300, 900
    evaluationPeriods: number;
    resourceId: string;
    namespace?: string;
    actions?: string[]; // Action Group Resource IDs
}

/**
 * Normalizes comparison operators from AWS-compatible frontend values to Azure values
 */
function normalizeComparisonOperator(op: string): string {
    switch (op) {
        case "GreaterThanOrEqualToThreshold":
        case "GreaterThanOrEqual":
            return "GreaterThanOrEqual";
        case "GreaterThanThreshold":
        case "GreaterThan":
            return "GreaterThan";
        case "LessThanOrEqualToThreshold":
        case "LessThanOrEqual":
            return "LessThanOrEqual";
        case "LessThanThreshold":
        case "LessThan":
            return "LessThan";
        default:
            return "GreaterThan";
    }
}

/**
 * Normalizes Azure comparison operator back to AWS-compatible frontend value
 */
function denormalizeComparisonOperator(op: string): string {
    switch (op) {
        case "GreaterThanOrEqual":
            return "GreaterThanOrEqualToThreshold";
        case "GreaterThan":
            return "GreaterThanThreshold";
        case "LessThanOrEqual":
            return "LessThanOrEqualToThreshold";
        case "LessThan":
            return "LessThanThreshold";
        default:
            return "GreaterThanThreshold";
    }
}

/**
 * Normalizes Azure Metric Alert Rule to unified alarm shape
 */
function normalizeMetricAlert(rule: any, region: string): any {
    const criteria = rule.properties?.criteria?.allOf?.[0] || {};
    const actions = rule.properties?.actions?.map((a: any) => a.actionGroupId) || [];
    
    // Determine state from Azure's rule configuration or active alerts (defaulting to OK)
    // Azure alerts have separate status querying, but we map standard configuration properties here
    const state = rule.properties?.enabled ? "OK" : "INSUFFICIENT_DATA";
    
    const resourceId = rule.properties?.scopes?.[0] || "";
    const dimensionName = criteria.dimensions?.[0]?.name || "";
    const dimensionValue = criteria.dimensions?.[0]?.values?.[0] || "";
    const dimensions = dimensionName ? [{ Name: dimensionName, Value: dimensionValue }] : [];

    return {
        name: rule.name || "Unknown",
        arn: rule.id,
        state,
        namespace: criteria.metricNamespace || "Microsoft.Compute/virtualMachines",
        metric: criteria.metricName || "-",
        reason: rule.properties?.description || "",
        updatedAt: rule.properties?.lastUpdatedTime || null,
        region: rule.location || region,
        type: "metric",
        actionsEnabled: rule.properties?.enabled ?? false,
        actions,
        comparison: denormalizeComparisonOperator(criteria.operator),
        threshold: criteria.threshold ?? 0,
        period: criteria.timeAggregation ? 300 : 0, // Mock time-grain mapping
        evaluationPeriods: 1,
        statistic: criteria.timeAggregation || "Average",
        dimensions
    };
}

/**
 * Normalizes classic Azure Alert Rule to unified alarm shape
 */
function normalizeClassicAlert(rule: any, region: string): any {
    const condition = rule.properties?.condition || {};
    const actions = rule.properties?.actions?.map((a: any) => a.actionGroupId || a.customEmails) || [];
    const state = rule.properties?.isEnabled ? "OK" : "INSUFFICIENT_DATA";

    return {
        name: rule.name || "Unknown",
        arn: rule.id,
        state,
        namespace: condition.dataSource?.metricNamespace || "-",
        metric: condition.dataSource?.metricName || "-",
        reason: rule.properties?.description || "",
        updatedAt: rule.properties?.lastUpdatedTime || null,
        region: rule.location || region,
        type: "metric",
        actionsEnabled: rule.properties?.isEnabled ?? false,
        actions,
        comparison: denormalizeComparisonOperator(condition.operator),
        threshold: condition.threshold ?? 0,
        period: condition.windowSize ? 300 : 0,
        evaluationPeriods: 1,
        statistic: condition.timeAggregation || "Average",
        dimensions: []
    };
}

/**
 * Query Azure Monitor Alert Rules and Metric Alerts, then normalizes them
 */
export async function getAzureAlertRules(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    region?: string
): Promise<{ alarms: any[]; counts: { total: number; alarm: number; ok: number; insufficient: number } }> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        
        // Fetch modern Metric Alerts
        const metricAlertsUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Insights/metricAlerts?api-version=2018-03-01`;
        
        // Fetch classic Alert Rules (fallback fallback/aggregation)
        const classicAlertsUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Insights/alertRules?api-version=2016-03-01`;

        const [metricRes, classicRes] = await Promise.allSettled([
            axios.get(metricAlertsUrl, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000
            }),
            axios.get(classicAlertsUrl, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000
            })
        ]);

        const normalizedRules: any[] = [];

        if (metricRes.status === "fulfilled" && metricRes.value.data?.value) {
            metricRes.value.data.value.forEach((rule: any) => {
                normalizedRules.push(normalizeMetricAlert(rule, region || "eastus"));
            });
        }

        if (classicRes.status === "fulfilled" && classicRes.value.data?.value) {
            classicRes.value.data.value.forEach((rule: any) => {
                // Deduplicate by name if modern version exists
                if (!normalizedRules.some(r => r.name === rule.name)) {
                    normalizedRules.push(normalizeClassicAlert(rule, region || "eastus"));
                }
            });
        }

        // Apply region filter if specified and not 'all'
        const filteredRules = (region && region !== "all")
            ? normalizedRules.filter(r => (r.region || "").toLowerCase().replace(/\s+/g, "") === region.toLowerCase().replace(/\s+/g, ""))
            : normalizedRules;

        const counts = {
            total: filteredRules.length,
            alarm: filteredRules.filter(r => r.state === "ALARM").length,
            ok: filteredRules.filter(r => r.state === "OK").length,
            insufficient: filteredRules.filter(r => r.state === "INSUFFICIENT_DATA").length
        };

        return { alarms: filteredRules, counts };
    } catch (error: any) {
        console.warn("[getAzureAlertRules] Error fetching alerts:", error.message);
        return {
            alarms: [],
            counts: {
                total: 0,
                alarm: 0,
                ok: 0,
                insufficient: 0
            }
        };
    }
}

/**
 * Creates or Updates a Metric Alert Rule in Azure
 */
export async function putAzureMetricAlert(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    region: string,
    alarmName: string,
    params: AzureAlertParams
): Promise<{ success: boolean; message: string }> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        
        // Extract resource group from target resource ID
        // Format: /subscriptions/{subId}/resourceGroups/{resourceGroup}/...
        const rgMatch = params.resourceId.match(/resourceGroups\/([^\/]+)/i);
        const resourceGroup = rgMatch ? rgMatch[1] : "rabbittwatch-alerts-rg";
        
        const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Insights/metricAlerts/${alarmName}?api-version=2018-03-01`;

        const normalizedPeriod = `PT${params.period >= 3600 ? `${params.period / 3600}H` : `${params.period / 60}M`}`;

        // Build Azure Alert Rule Payload
        const payload = {
            location: region === "all" ? "global" : region,
            properties: {
                description: `Created via RabbittWatch for resource: ${params.resourceId}`,
                severity: 3,
                enabled: true,
                scopes: [params.resourceId],
                evaluationFrequency: "PT1M",
                windowSize: normalizedPeriod,
                criteria: {
                    "odata.type": "Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria",
                    allOf: [
                        {
                            name: "MetricCriteria1",
                            metricName: params.metric,
                            metricNamespace: params.namespace || (() => {
                                const match = params.resourceId.match(/providers\/([^\/]+\/[^\/]+(?:\/[^\/]+)?)/i);
                                if (match) {
                                    const ns = match[1];
                                    if (ns.toLowerCase().includes("microsoft.sql/servers") && params.resourceId.toLowerCase().includes("/databases/")) {
                                        return "Microsoft.Sql/servers/databases";
                                    }
                                    return ns;
                                }
                                return "Microsoft.Compute/virtualMachines";
                            })(),
                            operator: normalizeComparisonOperator(params.comparison),
                            threshold: params.threshold,
                            timeAggregation: "Average",
                            dimensions: []
                        }
                    ]
                },
                actions: params.actions?.map(id => ({ actionGroupId: id, webHookProperties: {} })) || []
            }
        };

        await axios.put(url, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            timeout: 15000
        });

        return { success: true, message: `Azure Alert Rule ${alarmName} saved successfully.` };
    } catch (error: any) {
        console.error("[putAzureMetricAlert] Error saving alert rule:", error?.response?.data || error.message);
        throw new Error(`Failed to save Azure metric alert: ${error.message}`);
    }
}

/**
 * Toggle Azure Alert Rule Action state (enable/disable)
 */
export async function toggleAzureAlertRule(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    alarmName: string,
    enabled: boolean
): Promise<{ success: boolean; enabled: boolean; message: string }> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        
        // Locate rule first to get its payload
        const listUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Insights/metricAlerts?api-version=2018-03-01`;
        const res = await axios.get(listUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const existingRule = res.data?.value?.find((r: any) => r.name === alarmName);
        if (!existingRule) {
            throw new Error(`Alert rule ${alarmName} not found.`);
        }

        const updateUrl = `https://management.azure.com${existingRule.id}?api-version=2018-03-01`;
        existingRule.properties.enabled = enabled;

        await axios.put(updateUrl, existingRule, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        return {
            success: true,
            enabled,
            message: `Alert actions ${enabled ? "enabled" : "disabled"} for ${alarmName}`
        };
    } catch (error: any) {
        console.error("[toggleAzureAlertRule] Error:", error?.response?.data || error.message);
        throw new Error(`Failed to toggle Azure alert rule: ${error.message}`);
    }
}

/**
 * Delete Azure Alert Rule
 */
export async function deleteAzureAlertRule(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    alarmName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        
        // Find fully qualified resource path for deletion
        const listUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Insights/metricAlerts?api-version=2018-03-01`;
        const res = await axios.get(listUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const existingRule = res.data?.value?.find((r: any) => r.name === alarmName);
        if (!existingRule) {
            throw new Error(`Alert rule ${alarmName} not found.`);
        }

        const deleteUrl = `https://management.azure.com${existingRule.id}?api-version=2018-03-01`;
        await axios.delete(deleteUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return { success: true, message: `Alert rule ${alarmName} deleted successfully.` };
    } catch (error: any) {
        console.error("[deleteAzureAlertRule] Error:", error?.response?.data || error.message);
        throw new Error(`Failed to delete Azure alert rule: ${error.message}`);
    }
}

/**
 * List Azure Action Groups (equivalent of SNS topics)
 */
export async function getAzureActionGroups(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    region?: string
): Promise<Array<{ label: string; value: string }>> {
    try {
        const token = await getAzureAccessToken(tenantId, clientId, clientSecret);
        const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Insights/actionGroups?api-version=2019-06-01`;
        
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });

        const groups = res.data?.value || [];
        return groups.map((g: any) => ({
            label: `${g.properties?.groupShortName || g.name} (${g.location})`,
            value: g.id
        }));
    } catch (error: any) {
        console.warn("[getAzureActionGroups] Error fetching action groups:", error.message);
        return [];
    }
}

/**
 * Generates mock alert rules for fallbacks or offline environments
 */
function getSimulatedAlertRules(region?: string): any[] {
    const isGlobal = !region || region === "all";
    const selectedRegion = isGlobal ? "eastus" : region;
    
    return [
        {
            name: "rabbittwatch-ec2-high-cpu-vm-prod-01",
            arn: `/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Insights/metricAlerts/rabbittwatch-ec2-high-cpu-vm-prod-01`,
            state: "OK",
            namespace: "Microsoft.Compute/virtualMachines",
            metric: "Percentage CPU",
            reason: "CPU utilization is normal",
            updatedAt: new Date().toISOString(),
            region: selectedRegion,
            type: "metric",
            actionsEnabled: true,
            actions: ["/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Insights/actionGroups/DefaultEmailGroup"],
            comparison: "GreaterThanThreshold",
            threshold: 80,
            period: 300,
            evaluationPeriods: 1,
            statistic: "Average",
            dimensions: [{ Name: "vm-prod-01", Value: "vm-prod-01" }]
        },
        {
            name: "rabbittwatch-rds-high-dtu-db-prod-01",
            arn: `/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Insights/metricAlerts/rabbittwatch-rds-high-dtu-db-prod-01`,
            state: "OK",
            namespace: "Microsoft.Sql/servers/databases",
            metric: "dtu_consumption_percent",
            reason: "DTU utilization is normal",
            updatedAt: new Date().toISOString(),
            region: selectedRegion,
            type: "metric",
            actionsEnabled: true,
            actions: ["/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Insights/actionGroups/DefaultEmailGroup"],
            comparison: "GreaterThanThreshold",
            threshold: 90,
            period: 300,
            evaluationPeriods: 1,
            statistic: "Average",
            dimensions: [{ Name: "db-prod-01", Value: "db-prod-01" }]
        }
    ];
}
