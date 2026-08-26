// AWS Logs Service — Smart log group resolution from service registry
import { queryLogs as queryLogsProvider, listActiveLogGroups, describeLogGroupsByPrefix } from "../../providers/logs.provider";
import { DEFAULT_REGION } from "../../providers/client-factory";
import { SERVICE_REGISTRY } from "../../../../data/service-registry";
import { getResourceInventory } from "../../providers/resources.provider";
import { LogQueryResult } from "../../models/aws.model";

// ─── Manual query (existing behavior) ───
export async function queryLogs(
    workspaceId: string, query: string, logGroups: string[], range: number,
    region?: string, roleArn?: string, externalId?: string
) {
    return queryLogsProvider(workspaceId, query, logGroups, range, region, roleArn, externalId);
}

// ─── Resolve a single log group for a specific resource ───
function resolveLogGroupForResource(
    serviceKey: string,
    pattern: string,
    resourceId: string
): string | null {
    switch (serviceKey) {
        case "lambda": return `/aws/lambda/${resourceId}`;
        case "rds": return `/aws/rds/instance/${resourceId}`;
        case "ecs": return `/ecs/${resourceId}`;
        case "eks": return `/aws/containerinsights/${resourceId}/application`;
        case "amplify": return `/aws/amplify/${resourceId}`;
        case "apigateway": return `/aws/apigateway/${resourceId}/prod`;
        case "waf": return `aws-waf-logs-${resourceId}`;
        case "ec2": return pattern; // static log group, same for all
        default: return null;
    }
}

// ─── Smart log resolution by service key ───
export async function getServiceLogs(
    workspaceId: string,
    serviceKey: string,
    range: number = 3600,
    region?: string,
    roleArn?: string,
    externalId?: string,
    resourceId?: string
): Promise<{ logs: LogQueryResult[]; logGroups: string[]; hasLogs: boolean }> {
    const service = SERVICE_REGISTRY[serviceKey];
    if (!service?.logGroup) {
        return { logs: [], logGroups: [], hasLogs: false };
    }

    // If a specific resource is requested, bypass bulk resolution
    if (resourceId) {
        const logGroup = resolveLogGroupForResource(serviceKey, service.logGroup, resourceId);
        if (!logGroup) return { logs: [], logGroups: [], hasLogs: false };

        // Resource-specific logs belong to the resource's region (or requested region)
        const targetRegion = region && region !== "all" ? region : DEFAULT_REGION;
        const exists = await filterExistingLogGroups(workspaceId, [{ name: logGroup, region: targetRegion }], region, roleArn, externalId);

        if (exists.length === 0) return { logs: [], logGroups: [], hasLogs: false };
        const singleQuery = "fields @timestamp, @message, @logStream | sort @timestamp desc | limit 50";
        try {
            const logs = await queryLogsProvider(workspaceId, singleQuery, [exists[0].name], range, exists[0].region, roleArn, externalId);
            return { logs, logGroups: [exists[0].name], hasLogs: true };
        } catch { return { logs: [], logGroups: [exists[0].name], hasLogs: true }; }
    }

    // Resolve templated log group patterns using resource inventory
    const candidateLogGroups = await resolveLogGroups(
        workspaceId, serviceKey, service.logGroup, region, roleArn, externalId
    );

    if (candidateLogGroups.length === 0) {
        return { logs: [], logGroups: [], hasLogs: false };
    }

    // Validate which log groups actually exist in CloudWatch
    const existingLogGroups = await filterExistingLogGroups(
        workspaceId, candidateLogGroups, region, roleArn, externalId
    );

    if (existingLogGroups.length === 0) {
        console.log(`[Logs] No active log groups found for ${serviceKey} across ${candidateLogGroups.length} candidates`);
        return { logs: [], logGroups: [], hasLogs: false };
    }

    const query = "fields @timestamp, @message, @logStream | sort @timestamp desc | limit 50";

    try {
        // Group log groups by region for parallel execution
        const groupsByRegion = existingLogGroups.reduce((acc, curr) => {
            if (!acc[curr.region]) acc[curr.region] = [];
            acc[curr.region].push(curr.name);
            return acc;
        }, {} as Record<string, string[]>);

        console.log(`[Logs] Querying ${existingLogGroups.length} log groups for ${serviceKey} across ${Object.keys(groupsByRegion).length} regions`);

        // Execute queries in parallel across regions
        const regionalResults = await Promise.all(
            Object.entries(groupsByRegion).map(async ([r, groups]) => {
                try {
                    return await queryLogsProvider(workspaceId, query, groups, range, r, roleArn, externalId);
                } catch (e: any) {
                    console.warn(`[Logs] Parallel query failed for region ${r}:`, e.message);
                    return [];
                }
            })
        );

        // Flatten, sort, and limit to top 50 across all regions
        const combinedLogs = regionalResults.flat()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 50);

        return {
            logs: combinedLogs,
            logGroups: existingLogGroups.map(g => g.name),
            hasLogs: true
        };
    } catch (err: any) {
        console.warn(`[Logs] Failed to query logs for ${serviceKey}:`, err.message);
        return {
            logs: [],
            logGroups: existingLogGroups.map(g => g.name),
            hasLogs: true
        };
    }
}

// ─── Validate log groups exist ───
// Uses describeLogGroupsByPrefix to check which candidate log groups actually exist in CloudWatch
async function filterExistingLogGroups(
    workspaceId: string,
    candidates: { name: string, region: string }[],
    region?: string,
    roleArn?: string,
    externalId?: string
): Promise<{ name: string, region: string }[]> {
    try {
        const found: { name: string, region: string }[] = [];
        // Parallel validation against regional endpoints
        await Promise.all(candidates.map(async (c) => {
            const matches = await describeLogGroupsByPrefix(workspaceId, c.name, c.region, roleArn, externalId);
            if (matches.includes(c.name)) {
                found.push(c);
            }
        }));
        return found.slice(0, 20);
    } catch (err: any) {
        console.warn(`[Logs] Failed to validate log groups:`, err.message);
        return [];
    }
}

// ─── Log group template resolver ───
// Patterns like "/aws/lambda/{function_name}" get resolved using resource inventory
async function resolveLogGroups(
    workspaceId: string,
    serviceKey: string,
    pattern: string,
    region?: string,
    roleArn?: string,
    externalId?: string
): Promise<{ name: string, region: string }[]> {
    // If pattern has no template variables, it's a global/fixed group for the specific region requested
    if (!pattern.includes("{")) {
        return [{ name: pattern, region: region || DEFAULT_REGION }];
    }

    const inventory = await getResourceInventory(workspaceId, region, roleArn, externalId);
    const candidates: { name: string, region: string }[] = [];

    switch (serviceKey) {
        case "lambda": {
            const functions = inventory.lambda || [];
            for (const fn of functions.slice(0, 20)) {
                if (fn.name && fn.region) candidates.push({ name: `/aws/lambda/${fn.name}`, region: fn.region });
            }
            break;
        }

        case "ecs": {
            const services = inventory.ecs || [];
            const clusterNames = new Set<string>();
            for (const svc of services) {
                if (svc.cluster && svc.region) clusterNames.add(`${svc.region}:${svc.cluster}`);
            }
            for (const entry of clusterNames) {
                const [r, c] = entry.split(":");
                candidates.push({ name: `/ecs/${c}`, region: r });
            }
            break;
        }

        case "eks": {
            const clusters = inventory.eks || [];
            for (const cluster of clusters.slice(0, 10)) {
                if (cluster.name && cluster.region) {
                    candidates.push({ name: `/aws/containerinsights/${cluster.name}/application`, region: cluster.region });
                }
            }
            break;
        }

        case "rds": {
            const dbs = inventory.rds || [];
            for (const db of dbs.slice(0, 10)) {
                if (db.id && db.region) candidates.push({ name: `/aws/rds/instance/${db.id}`, region: db.region });
            }
            break;
        }

        case "amplify": {
            const apps = inventory.amplify || [];
            for (const app of apps.slice(0, 10)) {
                if (app.id && app.region) candidates.push({ name: `/aws/amplify/${app.id}`, region: app.region });
            }
            break;
        }

        case "apigateway": {
            const apis = inventory.apigateway || [];
            for (const api of apis.slice(0, 10)) {
                if (api.id && api.region) {
                    candidates.push({ name: `/aws/apigateway/${api.id}/prod`, region: api.region });
                    candidates.push({ name: `/aws/apigateway/${api.id}/$default`, region: api.region });
                }
            }
            break;
        }

        case "waf": {
            const acls = inventory.waf || [];
            for (const acl of acls.slice(0, 10)) {
                if (acl.name && acl.region) candidates.push({ name: `aws-waf-logs-${acl.name}`, region: acl.region });
            }
            break;
        }

        default: {
            const prefix = pattern.split("{")[0];
            try {
                // If we're searching global, we'd need to list across all, but listActive is regional
                // For now, fall back to the requested or default region
                const targetRegion = region && region !== "all" ? region : DEFAULT_REGION;
                const activeGroups = await listActiveLogGroups(workspaceId, targetRegion, roleArn, externalId);
                for (const group of activeGroups) {
                    if (group.name?.startsWith(prefix)) {
                        candidates.push({ name: group.name, region: targetRegion });
                    }
                }
            } catch { /* ignore discovery failure */ }
            break;
        }
    }

    return candidates.slice(0, 25);
}
