import { ResourceInventory } from "../../models/aws.model";
import { createGcpGoogleApisClient } from "./client-factory";

export const DEFAULT_GCP_REGION = "us-central1";

type GcpClients = ReturnType<typeof createGcpGoogleApisClient>;

interface GcpDiscoveryWarning {
    service: string;
    message: string;
}

function emptyInventory(): ResourceInventory {
    return {
        ec2: [],
        lambda: [],
        rds: [],
        s3: [],
        ecs: [],
        amplify: [],
        dynamodb: [],
        sqs: [],
        alb: [],
        alerts: [],
        ebs: [],
        eks: [],
        autoscaling: [],
        elasticache: [],
        redshift: [],
        cloudfront: [],
        efs: [],
        kinesis: [],
        sns: [],
        eventbridge: [],
        stepfunctions: [],
        waf: [],
        apigateway: [],
    };
}

function finishInventory(inventory: ResourceInventory): ResourceInventory {
    const countKeys = Object.keys(inventory);
    inventory.counts = { total: 0 };
    let total = 0;

    for (const key of countKeys) {
        // Skip internal metadata and alert keys from resource counts
        if (key.startsWith("__") || key === "counts" || key === "alerts") continue;
        if (Array.isArray(inventory[key])) {
            inventory.counts[key] = inventory[key].length;
            total += inventory[key].length;
        }
    }

    inventory.counts.total = total;
    return inventory;
}

function parseScopeName(key: string): string {
    return key.split("/").pop() || key;
}

function zoneToRegion(zone: string): string {
    const zoneName = parseScopeName(zone);
    return zoneName.replace(/-[a-z]$/, "");
}

function regionFromLocation(location?: string): string {
    if (!location) return "global";
    const value = location.toLowerCase();
    if (value.includes("-")) return value;
    return value;
}

function matchesRegion(resourceRegion: string | undefined, regionFilter: string): boolean {
    if (!regionFilter || regionFilter === "all") return true;
    return (resourceRegion || "").toLowerCase() === regionFilter.toLowerCase();
}

async function safeList<T>(label: string, warnings: GcpDiscoveryWarning[], fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn();
    } catch (error: any) {
        const message = error?.response?.data?.error?.message || error?.message || "unknown error";
        warnings.push({ service: label, message });
        console.warn(`[gcp/resources.provider] ${label} discovery skipped: ${message}`);
        return null;
    }
}

function machineTypeName(machineType?: string): string {
    return machineType ? machineType.split("/").pop() || machineType : "unknown";
}

async function listComputeInstances(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Compute Engine instances", warnings, () =>
        clients.compute.instances.aggregatedList({ project: clients.projectId })
    );
    const items = response?.data?.items || {};
    const instances: any[] = [];

    for (const [scope, scopedList] of Object.entries(items) as Array<[string, any]>) {
        const zone = parseScopeName(scope);
        const resourceRegion = zoneToRegion(zone);
        if (!matchesRegion(resourceRegion, region)) continue;

        for (const instance of scopedList.instances || []) {
            const publicIp = instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || null;
            instances.push({
                id: String(instance.id || instance.selfLink || instance.name),
                name: instance.name,
                state: String(instance.status || "unknown").toLowerCase(),
                type: machineTypeName(instance.machineType),
                region: resourceRegion,
                zone,
                launchTime: instance.creationTimestamp ? new Date(instance.creationTimestamp) : undefined,
                asgName: instance.metadata?.items?.find((item: any) => item.key === "created-by")?.value || null,
                isStateful: true,
                purchaseType: instance.scheduling?.preemptible || instance.scheduling?.provisioningModel === "SPOT" ? "spot" : "on_demand",
                tags: instance.labels || {},
                networkInterfaces: instance.networkInterfaces || [],
                selfLink: instance.selfLink,
                publicIp,
            });
        }

    }

    return instances;
}

async function listComputeDisks(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Persistent disks", warnings, () =>
        clients.compute.disks.aggregatedList({ project: clients.projectId })
    );
    const items = response?.data?.items || {};
    const disks: any[] = [];

    for (const [scope, scopedList] of Object.entries(items) as Array<[string, any]>) {
        const zone = parseScopeName(scope);
        const resourceRegion = zoneToRegion(zone);
        if (!matchesRegion(resourceRegion, region)) continue;

        for (const disk of scopedList.disks || []) {
            disks.push({
                id: String(disk.id || disk.selfLink || disk.name),
                name: disk.name,
                state: disk.users?.length ? "in-use" : "available",
                sizeGiB: disk.sizeGb ? Number(disk.sizeGb) : undefined,
                type: machineTypeName(disk.type),
                region: resourceRegion,
                zone,
                creationDate: disk.creationTimestamp ? new Date(disk.creationTimestamp) : undefined,
                selfLink: disk.selfLink,
            });
        }
    }

    return disks;
}

async function listStorageBuckets(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Cloud Storage buckets", warnings, () =>
        clients.storage.buckets.list({ project: clients.projectId })
    );
    const buckets = response?.data?.items || [];

    return buckets
        .map((bucket: any) => ({
            id: bucket.id || bucket.name,
            name: bucket.name,
            creationDate: bucket.timeCreated ? new Date(bucket.timeCreated) : undefined,
            region: regionFromLocation(bucket.location),
            storageClass: bucket.storageClass,
            tags: bucket.labels || {},
            selfLink: bucket.selfLink,
        }))
        .filter((bucket: any) => matchesRegion(bucket.region, region));
}

async function listCloudSqlInstances(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Cloud SQL instances", warnings, () =>
        clients.sqladmin.instances.list({ project: clients.projectId })
    );
    const instances = response?.data?.items || [];

    return instances
        .map((instance: any) => ({
            id: instance.name,
            name: instance.name,
            engine: instance.databaseVersion,
            status: instance.state,
            class: instance.settings?.tier,
            region: instance.region || "global",
            connectionName: instance.connectionName,
            selfLink: instance.selfLink,
        }))
        .filter((instance: any) => matchesRegion(instance.region, region));
}

async function listCloudFunctions(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Cloud Functions", warnings, () =>
        clients.cloudfunctions.projects.locations.functions.list({
            parent: `projects/${clients.projectId}/locations/-`,
        })
    );
    const functions = response?.data?.functions || [];

    return functions
        .map((fn: any) => {
            const location = fn.name?.split("/locations/")[1]?.split("/")[0] || "global";
            return {
                id: fn.name,
                name: fn.name?.split("/").pop() || fn.name,
                runtime: fn.runtime,
                memory: fn.availableMemoryMb,
                timeout: fn.timeout,
                region: location,
                status: fn.status,
                lastModified: fn.updateTime ? new Date(fn.updateTime) : undefined,
                selfLink: fn.name,
            };
        })
        .filter((fn: any) => matchesRegion(fn.region, region));
}

async function listCloudRunServices(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Cloud Run services", warnings, () =>
        clients.run.projects.locations.services.list({
            parent: `projects/${clients.projectId}/locations/-`,
        })
    );
    const services = response?.data?.services || [];

    return services
        .map((service: any) => {
            const location = service.name?.split("/locations/")[1]?.split("/")[0] || service.location || "global";
            return {
                id: service.name,
                name: service.name?.split("/").pop() || service.name,
                region: location,
                status: service.conditions?.find((condition: any) => condition.type === "Ready")?.state || "unknown",
                uri: service.uri,
                createdAt: service.createTime ? new Date(service.createTime) : undefined,
                updatedAt: service.updateTime ? new Date(service.updateTime) : undefined,
            };
        })
        .filter((service: any) => matchesRegion(service.region, region));
}

async function listGkeClusters(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("GKE clusters", warnings, () =>
        clients.container.projects.locations.clusters.list({
            parent: `projects/${clients.projectId}/locations/-`,
        })
    );
    const clusters = response?.data?.clusters || [];

    return clusters
        .map((cluster: any) => ({
            id: cluster.selfLink || cluster.name,
            name: cluster.name,
            region: zoneToRegion(cluster.location || ""),
            zone: cluster.location,
            status: cluster.status,
            version: cluster.currentMasterVersion,
            nodeCount: cluster.currentNodeCount,
            endpoint: cluster.endpoint,
        }))
        .filter((cluster: any) => matchesRegion(cluster.region, region) || matchesRegion(cluster.zone, region));
}

async function listPubSub(clients: GcpClients, warnings: GcpDiscoveryWarning[]) {
    const [topicsResponse, subscriptionsResponse]: any[] = await Promise.all([
        safeList("Pub/Sub topics", warnings, () =>
            clients.pubsub.projects.topics.list({ project: `projects/${clients.projectId}` })
        ),
        safeList("Pub/Sub subscriptions", warnings, () =>
            clients.pubsub.projects.subscriptions.list({ project: `projects/${clients.projectId}` })
        ),
    ]);

    const topics = (topicsResponse?.data?.topics || []).map((topic: any) => ({
        id: topic.name,
        name: topic.name?.split("/").pop() || topic.name,
        region: "global",
        selfLink: topic.name,
    }));

    const subscriptions = (subscriptionsResponse?.data?.subscriptions || []).map((sub: any) => ({
        id: sub.name,
        name: sub.name?.split("/").pop() || sub.name,
        topic: sub.topic,
        region: "global",
        selfLink: sub.name,
    }));

    return { topics, subscriptions };
}

async function listForwardingRules(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Load balancer forwarding rules", warnings, () =>
        clients.compute.forwardingRules.aggregatedList({ project: clients.projectId })
    );
    const items = response?.data?.items || {};
    const rules: any[] = [];

    for (const [scope, scopedList] of Object.entries(items) as Array<[string, any]>) {
        const resourceRegion = scope.startsWith("regions/") ? parseScopeName(scope) : "global";
        if (!matchesRegion(resourceRegion, region) && region !== "all") continue;

        for (const rule of scopedList.forwardingRules || []) {
            rules.push({
                id: String(rule.id || rule.selfLink || rule.name),
                name: rule.name,
                region: resourceRegion,
                status: "active",
                ipAddress: rule.IPAddress,
                portRange: rule.portRange,
                loadBalancingScheme: rule.loadBalancingScheme,
                selfLink: rule.selfLink,
            });
        }
    }

    return rules;
}

async function listInstanceGroupManagers(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Compute Engine instance group managers", warnings, () =>
        clients.compute.instanceGroupManagers.aggregatedList({ project: clients.projectId })
    );
    const items = response?.data?.items || {};
    const groups: any[] = [];

    for (const [scope, scopedList] of Object.entries(items) as Array<[string, any]>) {
        const zoneOrRegion = parseScopeName(scope);
        const resourceRegion = scope.includes("/regions/") ? zoneOrRegion : zoneToRegion(zoneOrRegion);
        if (!matchesRegion(resourceRegion, region)) continue;

        for (const igm of scopedList.instanceGroupManagers || []) {
            groups.push({
                id: String(igm.id || igm.selfLink || igm.name),
                name: igm.name,
                region: resourceRegion,
                targetSize: igm.targetSize || 0,
                status: igm.status || {},
                selfLink: igm.selfLink,
            });
        }
    }

    return groups;
}

async function listArtifactRegistryRepositories(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("Artifact Registry repositories", warnings, () =>
        (clients as any).artifactregistry.projects.locations.repositories.list({
            parent: `projects/${clients.projectId}/locations/-`,
        })
    );
    const repos = response?.data?.repositories || [];

    return repos
        .map((repo: any) => {
            const location = repo.name?.split("/locations/")[1]?.split("/")[0] || "global";
            return {
                id: repo.name,
                name: repo.name?.split("/").pop() || repo.name,
                region: location,
                format: repo.format,
                selfLink: repo.name,
            };
        })
        .filter((repo: any) => matchesRegion(repo.region, region));
}

async function listAppEngineApps(clients: GcpClients, region: string, warnings: GcpDiscoveryWarning[]) {
    const response: any = await safeList("App Engine apps", warnings, () =>
        clients.appengine.apps.get({ appsId: clients.projectId })
    );
    if (!response || !response.data) return [];
    const app = response.data;
    const appRegion = regionFromLocation(app.locationId);
    if (!matchesRegion(appRegion, region)) return [];

    return [{
        id: app.id || clients.projectId,
        name: app.id || "default",
        region: appRegion,
        state: app.servingStatus === "SERVING" ? "running" : "stopped",
        type: "Standard",
        selfLink: `https://console.cloud.google.com/appengine?project=${clients.projectId}`,
    }];
}

/**
 * Discovers GCP resources under a project.
 * Groups and normalizes resources to match the AWS ResourceInventory shape.
 */
export async function getGcpResourceInventory(
    projectId: string,
    clientEmail: string,
    privateKey: string,
    region: string = "all"
): Promise<ResourceInventory> {
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing GCP integration credentials");
    }

    const clients = createGcpGoogleApisClient({ projectId, clientEmail, privateKey });
    const inventory = emptyInventory();
    const warnings: GcpDiscoveryWarning[] = [];

    const [
        instances,
        disks,
        buckets,
        sqlInstances,
        functions,
        runServices,
        clusters,
        pubsub,
        forwardingRules,
        instanceGroupManagers,
        repositories,
        appEngineApps,
    ] = await Promise.all([
        listComputeInstances(clients, region, warnings),
        listComputeDisks(clients, region, warnings),
        listStorageBuckets(clients, region, warnings),
        listCloudSqlInstances(clients, region, warnings),
        listCloudFunctions(clients, region, warnings),
        listCloudRunServices(clients, region, warnings),
        listGkeClusters(clients, region, warnings),
        listPubSub(clients, warnings),
        listForwardingRules(clients, region, warnings),
        listInstanceGroupManagers(clients, region, warnings),
        listArtifactRegistryRepositories(clients, region, warnings),
        listAppEngineApps(clients, region, warnings),
    ]);

    inventory.ec2 = instances;
    inventory.ebs = disks;
    inventory.s3 = buckets;
    inventory.rds = sqlInstances;
    inventory.lambda = [...functions, ...runServices];
    inventory.amplify = appEngineApps;
    inventory.eks = clusters;
    inventory.sns = pubsub.topics;
    inventory.sqs = pubsub.subscriptions;
    inventory.alb = forwardingRules;
    inventory.autoscaling = instanceGroupManagers;
    inventory.ecr = repositories;
    inventory.__source = "real";
    inventory.__warnings = warnings;

    return finishInventory(inventory);
}
