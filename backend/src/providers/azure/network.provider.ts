import {
    ResourceGraphRow,
    AzureDiscoveryWarning,
    normalizeAzureRegion,
    matchesRegion,
    normalizeAzureId
} from "./helper";

export function buildAzureNetworkLookup(resources: ResourceGraphRow[]) {
    const publicIpsById = new Map<string, ResourceGraphRow>();
    const nicsById = new Map<string, ResourceGraphRow>();

    for (const resource of resources) {
        const type = resource.type?.toLowerCase();
        if (type === "microsoft.network/publicipaddresses") {
            publicIpsById.set(normalizeAzureId(resource.id), resource);
        }
        if (type === "microsoft.network/networkinterfaces") {
            nicsById.set(normalizeAzureId(resource.id), resource);
        }
    }

    return { publicIpsById, nicsById };
}

export function mapVirtualNetworks(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.network/virtualnetworks")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                const subnets = props.subnets || [];
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    addressPrefixes: props.addressSpace?.addressPrefixes || [],
                    subnetCount: subnets.length,
                    status: props.provisioningState || "Succeeded",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Virtual Networks", message: error.message });
        return [];
    }
}

export function mapLoadBalancers(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => {
                const t = r.type.toLowerCase();
                return t === "microsoft.network/loadbalancers" || t === "microsoft.network/applicationgateways";
            })
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    type: r.type.toLowerCase().includes("applicationgateways") ? "Application Gateway" : "Load Balancer",
                    skuName: r.sku?.name || "Basic",
                    status: props.provisioningState || "Succeeded",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Load Balancers / Application Gateways", message: error.message });
        return [];
    }
}

export function mapCdnAndFrontDoor(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => {
                const t = r.type.toLowerCase();
                return t === "microsoft.cdn/profiles" || t === "microsoft.network/frontdoors";
            })
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location || "global",
                    type: r.type.toLowerCase().includes("frontdoors") ? "Front Door" : "CDN Profile",
                    sku: r.sku?.name,
                    status: props.provisioningState || props.resourceState || "Active",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "CDN / Front Door", message: error.message });
        return [];
    }
}

export function mapApiManagement(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.apimanagement/service")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    sku: r.sku?.name || "Consumption",
                    gatewayUrl: props.gatewayUrl,
                    status: props.provisioningState || "Succeeded",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "API Management", message: error.message });
        return [];
    }
}

export function mapNsgs(resources: ResourceGraphRow[], region: string, warnings: AzureDiscoveryWarning[]): any[] {
    try {
        return resources
            .filter(r => r.type.toLowerCase() === "microsoft.network/networksecuritygroups")
            .filter(r => matchesRegion(normalizeAzureRegion(r.location), region))
            .map(r => {
                const props = r.properties || {};
                const rules = props.securityRules || [];
                return {
                    id: r.id,
                    name: r.name,
                    region: r.location,
                    ruleCount: rules.length,
                    status: props.provisioningState || "Succeeded",
                    resourceGroup: r.resourceGroup,
                    tags: r.tags || {},
                };
            });
    } catch (error: any) {
        warnings.push({ service: "Network Security Groups", message: error.message });
        return [];
    }
}
