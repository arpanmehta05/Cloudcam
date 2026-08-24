import {
    ResourceGraphRow,
    AzureDiscoveryWarning,
    normalizeAzureRegion,
    matchesRegion,
    normalizeAzureId
} from "./helper";
import { buildAzureNetworkLookup } from "./network.provider";

export function mapVirtualMachines(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        const { publicIpsById, nicsById } = buildAzureNetworkLookup(resources);
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.compute/virtualmachines")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                const powerState = props.extended?.instanceView?.powerState?.displayStatus ||
                    r.tags?.powerstate || "running";
                const status = String(powerState).toLowerCase();
                const vmNicRefs = props.networkProfile?.networkInterfaces || [];
                const networkInterfaces = vmNicRefs
                    .map((nicRef: any) => nicsById.get(normalizeAzureId(nicRef?.id)))
                    .filter(Boolean);
                const privateIps: string[] = [];
                const publicIps: string[] = [];

                for (const nic of networkInterfaces) {
                    const ipConfigs = nic.properties?.ipConfigurations || [];
                    for (const config of Array.isArray(ipConfigs) ? ipConfigs : []) {
                        const configProps = config.properties || {};
                        if (configProps.privateIPAddress) {
                            privateIps.push(configProps.privateIPAddress);
                        }

                        const pipId = normalizeAzureId(configProps.publicIPAddress?.id);
                        const pip = pipId ? publicIpsById.get(pipId) : null;
                        const ipAddress = pip?.properties?.ipAddress || configProps.publicIPAddress?.properties?.ipAddress;
                        if (ipAddress) {
                            publicIps.push(ipAddress);
                        }
                    }
                }

                return {
                    id: r.id,
                    name: r.name,
                    state: status.includes("deallocated") || status.includes("stopped") ? "stopped" : "running",
                    type: props.hardwareProfile?.vmSize || "Standard_B2s",
                    region: r.location,
                    launchTime: props.timeCreated || new Date(),
                    asgName: r.tags?.AutoScalingGroup || null,
                    isStateful: true,
                    purchaseType: "on_demand",
                    osType: props.storageProfile?.osDisk?.osType || "Unknown",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                    networkInterfaces,
                    privateIp: privateIps[0] || null,
                    privateIps,
                    publicIp: publicIps[0] || null,
                    publicIps,
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Virtual Machines", message: error.message });
        return [];
    }
}

export function mapFunctions(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => {
                if (r.type.toLowerCase() !== "microsoft.web/sites") return false;
                const kind = (r.kind || r.properties?.kind || "").toLowerCase();
                return kind.includes("functionapp");
            })
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    runtime: props.siteConfig?.linuxFxVersion || props.siteConfig?.windowsFxVersion || "unknown",
                    memory: 1536,
                    timeout: 300,
                    region: r.location,
                    lastModified: props.lastModifiedTimeUtc ? new Date(props.lastModifiedTimeUtc) : undefined,
                    status: props.state || "Running",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Azure Functions", message: error.message });
        return [];
    }
}

export function mapAppServices(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        const webApps = resources
            .filter(r => {
                if (r.type.toLowerCase() !== "microsoft.web/sites") return false;
                const kind = (r.kind || r.properties?.kind || "").toLowerCase();
                return !kind.includes("functionapp");
            })
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    status: props.state || "Running",
                    defaultHostName: props.defaultHostName,
                    kind: r.kind || "app",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });

        const containerApps = resources
            .filter(r => r.type.toLowerCase() === "microsoft.app/containerapps")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    status: props.provisioningState || props.runningStatus || "Running",
                    kind: "containerapp",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });

        return [...webApps, ...containerApps];
    } catch (error: any) {
        warnings.push({ service: "App Service / Container Apps", message: error.message });
        return [];
    }
}

export function mapAks(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.containerservice/managedclusters")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                const agentPools = props.agentPoolProfiles || [];
                const totalNodes = agentPools.reduce((sum: number, pool: any) => sum + (pool.count || 0), 0);

                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    status: props.provisioningState || "Succeeded",
                    version: props.kubernetesVersion || "unknown",
                    nodeCount: totalNodes,
                    agentPoolCount: agentPools.length,
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "AKS", message: error.message });
        return [];
    }
}
