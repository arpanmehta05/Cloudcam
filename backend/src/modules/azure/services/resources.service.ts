// Azure Resources Service — canonical location: modules/azure/services/resources.service.ts
import { getAzureResourceInventory } from "../providers/resources.provider";
import { AzureInventoryCacheModel } from "../models/azure-inventory-cache.model";
import mongoose from "mongoose";
import { ResourceInventory } from "../../../models/aws.model";

const INVENTORY_CACHE_MAX_AGE_MS = 3 * 60 * 1000;

async function refreshInventoryCache(
    workspaceId: string,
    targetRegion: string,
    tenantId: string,
    subscriptionId: string,
    clientId: string,
    clientSecret: string
): Promise<ResourceInventory> {
    const freshInventory = await getAzureResourceInventory(
        tenantId,
        subscriptionId,
        clientId,
        clientSecret,
        targetRegion
    );
    await AzureInventoryCacheModel.findOneAndUpdate(
        { workspaceId: new mongoose.Types.ObjectId(workspaceId), region: targetRegion },
        { inventory: freshInventory, lastUpdated: new Date() },
        { upsert: true, returnDocument: "after" }
    );
    return freshInventory;
}

export async function getResources(
    workspaceId: string,
    region: string = "all",
    tenantId?: string,
    subscriptionId?: string,
    clientId?: string,
    clientSecret?: string,
    forceRefresh: boolean = false
): Promise<ResourceInventory> {
    const targetRegion = region || "all";

    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
        throw new Error("Missing Azure credentials to retrieve resource inventory");
    }

    // 1. Try to find in cache
    const cache = await AzureInventoryCacheModel.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        region: targetRegion
    });

    const hasCache = !!cache;
    const cacheAge = cache?.lastUpdated ? Date.now() - new Date(cache.lastUpdated).getTime() : Infinity;
    const cacheIsFresh = cache && cacheAge <= INVENTORY_CACHE_MAX_AGE_MS;

    // 2. Cache miss / force-refresh → block and fetch live data
    // For "all" regions, a synchronous fetch is extremely slow and will time out the browser.
    // Therefore, if we have cached data, we return it immediately and update in the background.
    const shouldBlock = forceRefresh ? (targetRegion !== "all" || !hasCache) : !hasCache;

    if (shouldBlock) {
        console.log(
            `[azure/resources.service] ${forceRefresh ? "Force refresh (blocking)" : "No cache found"} for ${workspaceId} in ${targetRegion}. Fetching synchronously...`
        );
        return await refreshInventoryCache(workspaceId, targetRegion, tenantId, subscriptionId, clientId, clientSecret);
    }

    // 3. Cache is present (fresh or stale).
    // If forceRefresh is requested or the cache is stale, kick off a background refresh.
    if (forceRefresh || !cacheIsFresh) {
        console.log(
            `[azure/resources.service] Cache is ${forceRefresh ? "forced to refresh" : "stale"} for ${workspaceId} in ${targetRegion}. Kicking off background refresh...`
        );
        refreshInventoryCache(workspaceId, targetRegion, tenantId, subscriptionId, clientId, clientSecret)
            .then(() => {
                console.log(`[azure/resources.service] Background refresh completed for ${workspaceId} in ${targetRegion}`);
            })
            .catch(err => {
                console.error(`[azure/resources.service] Background refresh failed for ${workspaceId} in ${targetRegion}:`, err);
            });
    } else {
        console.log(`[azure/resources.service] Serving fresh cached inventory for ${workspaceId} in ${targetRegion}`);
    }

    return cache!.inventory;
}
