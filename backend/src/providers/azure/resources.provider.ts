import { ResourceInventory } from "../../models/aws.model";
import { getAzureAccessToken } from "./client-factory";
import {
    emptyInventory,
    finishInventory,
    queryResourceGraph,
    AzureDiscoveryWarning,
    DEFAULT_AZURE_REGION
} from "./helper";
import {
    mapVirtualMachines,
    mapFunctions,
    mapAppServices,
    mapAks
} from "./compute.provider";
import {
    mapVirtualNetworks,
    mapLoadBalancers,
    mapCdnAndFrontDoor,
    mapApiManagement,
    mapNsgs
} from "./network.provider";
import {
    mapManagedDisks,
    mapStorageAccounts,
    mapAzureSql,
    mapCosmosDb,
    mapServiceBus,
    mapRedisCache,
    mapEventHubs,
    mapLogicApps
} from "./storage.provider";

export { DEFAULT_AZURE_REGION };

/**
 * Discovers Azure resources under a subscription using Azure Resource Graph.
 * Groups and normalizes resources to match the AWS ResourceInventory shape
 * expected by the dashboard and detail views.
 */
export async function getAzureResourceInventory(
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string,
    region: string = "all"
): Promise<ResourceInventory> {
    const inventory = emptyInventory();
    const warnings: AzureDiscoveryWarning[] = [];

    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
        warnings.push({ service: "Authentication", message: "Missing Azure credentials for resource discovery." });
        inventory.__source = "unavailable";
        inventory.__warnings = warnings;
        return finishInventory(inventory);
    }

    let token: string;
    try {
        token = await getAzureAccessToken(tenantId, clientId, clientSecret);
    } catch (error: any) {
        warnings.push({ service: "Authentication", message: error.message || "Failed to obtain Azure access token." });
        inventory.__source = "unavailable";
        inventory.__warnings = warnings;
        return finishInventory(inventory);
    }

    const rawResources = await queryResourceGraph(token, subscriptionId, warnings);

    if (rawResources.length === 0 && warnings.length > 0) {
        inventory.__source = "error";
        inventory.__warnings = warnings;
        return finishInventory(inventory);
    }

    // Map all resource types
    inventory.ec2 = mapVirtualMachines(rawResources, region, warnings);
    inventory.ebs = mapManagedDisks(rawResources, region, warnings);
    inventory.s3 = mapStorageAccounts(rawResources, region, warnings);
    inventory.rds = mapAzureSql(rawResources, region, warnings);
    inventory.lambda = mapFunctions(rawResources, region, warnings);
    inventory.amplify = mapAppServices(rawResources, region, warnings);

    const aksClusters = mapAks(rawResources, region, warnings);
    inventory.eks = aksClusters;
    inventory.ecs = aksClusters.map(c => ({
        id: c.id,
        cluster: c.name,
        name: c.name,
        status: "ACTIVE",
        region: c.region,
    }));

    inventory.efs = mapVirtualNetworks(rawResources, region, warnings);
    inventory.alb = mapLoadBalancers(rawResources, region, warnings);
    inventory.dynamodb = mapCosmosDb(rawResources, region, warnings);

    const serviceBus = mapServiceBus(rawResources, region, warnings);
    inventory.sqs = serviceBus.queues;
    inventory.sns = serviceBus.topics;

    inventory.elasticache = mapRedisCache(rawResources, region, warnings);
    inventory.cloudfront = mapCdnAndFrontDoor(rawResources, region, warnings);
    inventory.kinesis = mapEventHubs(rawResources, region, warnings);
    inventory.stepfunctions = mapLogicApps(rawResources, region, warnings);
    inventory.apigateway = mapApiManagement(rawResources, region, warnings);
    inventory.waf = mapNsgs(rawResources, region, warnings);

    inventory.__source = "real";
    inventory.__warnings = warnings;

    return finishInventory(inventory);
}
