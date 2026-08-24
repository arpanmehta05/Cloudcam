// AWS Resources Service
import { getResourceInventory as getInventory } from "../../providers/resources.provider";
import { AwsInventoryCacheModel } from "../../models/aws-inventory-cache.model";
import mongoose from "mongoose";

const INVENTORY_CACHE_MAX_AGE_MS = 3 * 60 * 1000;

async function refreshInventoryCache(
    workspaceId: string,
    targetRegion: string,
    roleArn?: string,
    externalId?: string,
    forceRefresh: boolean = false
) {
    const freshInventory = await getInventory(workspaceId, targetRegion, roleArn, externalId, forceRefresh);
    await AwsInventoryCacheModel.findOneAndUpdate(
        { workspaceId: new mongoose.Types.ObjectId(workspaceId), region: targetRegion },
        { inventory: freshInventory, lastUpdated: new Date() },
        { upsert: true, returnDocument: "after" }
    );
    return freshInventory;
}

export async function getResources(
    workspaceId: string,
    region?: string,
    roleArn?: string,
    externalId?: string,
    forceRefresh: boolean = false
) {
    // "all" is a valid region token — the provider fans out over all enabled regions.
    // Fall back to "us-east-1" only when no region is supplied at all.
    const targetRegion = region || "us-east-1";
    
    // 1. Try DB cache
    const cache = await AwsInventoryCacheModel.findOne({
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
        `[resources.service] ${forceRefresh ? "Force refresh (blocking)" : "No cache found"} for ${workspaceId} in ${targetRegion}. Fetching synchronously...`
      );
      return await refreshInventoryCache(workspaceId, targetRegion, roleArn, externalId, forceRefresh);
    }

    // 3. Cache is present (fresh or stale).
    // If forceRefresh is requested or the cache is stale, kick off a background refresh.
    if (forceRefresh || !cacheIsFresh) {
      console.log(
        `[resources.service] Cache is ${forceRefresh ? "forced to refresh" : "stale"} for ${workspaceId} in ${targetRegion}. Kicking off background refresh...`
      );
      refreshInventoryCache(workspaceId, targetRegion, roleArn, externalId, forceRefresh).then(() => {
        console.log(`[resources.service] Background refresh completed for ${workspaceId} in ${targetRegion}`);
      }).catch(err => {
        console.error(`[resources.service] Background refresh failed for ${workspaceId} in ${targetRegion}:`, err);
      });
    } else {
      console.log(`[resources.service] Serving fresh cached inventory for ${workspaceId} in ${targetRegion}`);
    }

    return cache!.inventory;
}
