// GCP Resources Service — canonical location: modules/gcp/services/resources.service.ts
import { getGcpResourceInventory } from "../providers/resources.provider";
import { GcpInventoryCacheModel } from "../models/gcp-inventory-cache.model";
import mongoose from "mongoose";
import { ResourceInventory } from "../../../models/aws.model";

const INVENTORY_CACHE_MAX_AGE_MS = 3 * 60 * 1000;

async function refreshInventoryCache(
    workspaceId: string,
    targetRegion: string,
    projectId: string,
    clientEmail: string,
    privateKey: string
): Promise<ResourceInventory> {
    const freshInventory = await getGcpResourceInventory(
        projectId,
        clientEmail,
        privateKey,
        targetRegion
    );
    await GcpInventoryCacheModel.findOneAndUpdate(
        { workspaceId: new mongoose.Types.ObjectId(workspaceId), region: targetRegion },
        { inventory: freshInventory, lastUpdated: new Date() },
        { upsert: true, returnDocument: "after" }
    );
    return freshInventory;
}

export async function getResources(
    workspaceId: string,
    region: string = "all",
    projectId?: string,
    clientEmail?: string,
    privateKey?: string,
    forceRefresh: boolean = false
): Promise<ResourceInventory> {
    const targetRegion = region || "all";

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing GCP credentials to retrieve resource inventory");
    }

    const cache = await GcpInventoryCacheModel.findOne({
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
            `[gcp/resources.service] ${forceRefresh ? "Force refresh (blocking)" : "No cache found"} for ${workspaceId} in ${targetRegion}. Fetching synchronously...`
        );
        return await refreshInventoryCache(workspaceId, targetRegion, projectId, clientEmail, privateKey);
    }

    // 3. Cache is present (fresh or stale).
    // If forceRefresh is requested or the cache is stale, kick off a background refresh.
    if (forceRefresh || !cacheIsFresh) {
        console.log(
            `[gcp/resources.service] Cache is ${forceRefresh ? "forced to refresh" : "stale"} for ${workspaceId} in ${targetRegion}. Kicking off background refresh...`
        );
        refreshInventoryCache(workspaceId, targetRegion, projectId, clientEmail, privateKey)
            .then(() => {
                console.log(`[gcp/resources.service] Background refresh completed for ${workspaceId} in ${targetRegion}`);
            })
            .catch(err => {
                console.error(`[gcp/resources.service] Background refresh failed for ${workspaceId} in ${targetRegion}:`, err);
            });
    } else {
        console.log(`[gcp/resources.service] Serving fresh cached inventory for ${workspaceId} in ${targetRegion}`);
    }

    return cache!.inventory;
}
