import {
    ResourceGraphRow,
    AzureDiscoveryWarning,
    normalizeAzureRegion,
    matchesRegion
} from "./helper";

export function mapManagedDisks(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.compute/disks")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    state: props.diskState?.toLowerCase() === "attached" ? "in-use" : "available",
                    sizeGiB: props.diskSizeGB,
                    type: r.sku?.name || props.sku?.name || "Standard_LRS",
                    region: r.location,
                    creationDate: props.timeCreated ? new Date(props.timeCreated) : undefined,
                    osType: props.osType || null,
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Managed Disks", message: error.message });
        return [];
    }
}

export function mapStorageAccounts(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.storage/storageaccounts")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    creationDate: props.creationTime ? new Date(props.creationTime) : undefined,
                    region: r.location,
                    kind: r.kind || props.kind || "StorageV2",
                    skuName: r.sku?.name || "Standard_LRS",
                    accessTier: props.accessTier || "Hot",
                    httpsOnly: props.supportsHttpsTrafficOnly,
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Storage Accounts", message: error.message });
        return [];
    }
}

export function mapAzureSql(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        const sqlDatabases = resources
            .filter(r => r.type.toLowerCase() === "microsoft.sql/servers/databases")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    engine: "Azure SQL",
                    status: props.status || "Online",
                    class: props.currentServiceObjectiveName || "Basic",
                    region: r.location,
                    maxSizeBytes: props.maxSizeBytes,
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });

        const pgServers = resources
            .filter(r => r.type.toLowerCase() === "microsoft.dbforpostgresql/flexibleservers")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    engine: `PostgreSQL ${props.version || ""}`.trim(),
                    status: props.state || "Ready",
                    class: r.sku?.name || "Burstable_B1ms",
                    region: r.location,
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });

        const mysqlServers = resources
            .filter(r => r.type.toLowerCase() === "microsoft.dbformysql/flexibleservers")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    engine: `MySQL ${props.version || ""}`.trim(),
                    status: props.state || "Ready",
                    class: r.sku?.name || "Burstable_B1ms",
                    region: r.location,
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });

        return [...sqlDatabases, ...pgServers, ...mysqlServers];
    } catch (error: any) {
        warnings.push({ service: "Azure SQL / Database", message: error.message });
        return [];
    }
}

export function mapCosmosDb(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => {
                const t = r.type.toLowerCase();
                return t === "microsoft.documentdb/databaseaccounts" || t === "microsoft.cosmosdb/databaseaccounts";
            })
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    kind: r.kind || props.kind || "GlobalDocumentDB",
                    consistencyLevel: props.consistencyPolicy?.defaultConsistencyLevel,
                    status: props.provisioningState || "Succeeded",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Cosmos DB", message: error.message });
        return [];
    }
}

export function mapServiceBus(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): { queues: any[]; topics: any[] } {
    try {
        const matched = resources
            .filter(r => r.type.toLowerCase() === "microsoft.servicebus/namespaces")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region));

        const queues = matched.map(r => ({
            id: r.id,
            name: r.name,
            region: r.location,
            sku: r.sku?.name || "Basic",
            resourceGroup: r.resourceGroup,
            tags: r.tags || {},
        }));

        const topics = matched.map(r => ({
            id: r.id,
            name: r.name,
            region: r.location,
            sku: r.sku?.name || "Basic",
            resourceGroup: r.resourceGroup,
            tags: r.tags || {},
        }));

        return { queues, topics };
    } catch (error: any) {
        warnings.push({ service: "Service Bus", message: error.message });
        return { queues: [], topics: [] };
    }
}

export function mapRedisCache(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.cache/redis")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    sku: r.sku?.name || "Basic",
                    capacity: r.sku?.capacity,
                    port: props.port,
                    sslPort: props.sslPort,
                    status: props.provisioningState || "Succeeded",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Redis Cache", message: error.message });
        return [];
    }
}

export function mapEventHubs(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.eventhub/namespaces")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    sku: r.sku?.name || "Basic",
                    status: props.status || "Active",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Event Hubs", message: error.message });
        return [];
    }
}

export function mapLogicApps(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.logic/workflows")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    status: props.state || "Enabled",
                    createdTime: props.createdTime ? new Date(props.createdTime) : undefined,
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Logic Apps", message: error.message });
        return [];
    }
}
