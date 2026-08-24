import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";
import { ResourceInventory } from "../models/aws.model";
import { AWS_REGIONS } from "../../../packages/constants/src";
import { executeResourceInventory } from "./inventory-executor.provider";

const STATIC_DISCOVERY_REGIONS = AWS_REGIONS;
const REGION_CACHE_TTL_MS = 15 * 60 * 1000;

interface RegionCacheEntry {
  regions: string[];
  timestamp: number;
}

const enabledRegionCache = new Map<string, RegionCacheEntry>();

export function shouldLogResourceDiscoveryError(error: any): boolean {
  const name = error?.name || "";
  const message = String(error?.message || "").toLowerCase();

  if (
    name === "UnrecognizedClientException" ||
    name === "AccessDeniedException" ||
    name === "AccessDenied"
  ) {
    return false;
  }

  if (
    name === "AuthFailure" &&
    (message.includes("security token included in the request is invalid") ||
      message.includes("validate the provided access credentials"))
  ) {
    return false;
  }

  return true;
}

function buildRegionCacheKey(
  workspaceId: string,
  roleArn?: string,
  externalId?: string,
): string {
  return `${workspaceId}:${roleArn || "default"}:${externalId || "default"}`;
}

export async function getEnabledDiscoveryRegions(
  workspaceId: string,
  roleArn?: string,
  externalId?: string,
): Promise<string[]> {
  const key = buildRegionCacheKey(workspaceId, roleArn, externalId);
  const cached = enabledRegionCache.get(key);
  if (cached && Date.now() - cached.timestamp < REGION_CACHE_TTL_MS) {
    return cached.regions;
  }

  try {
    const cfg = await getClientConfig(
      workspaceId,
      "us-east-1",
      roleArn,
      externalId,
    );
    const ec2Client = new EC2Client(cfg);
    const regionsRes = await ec2Client.send(
      new DescribeRegionsCommand({ AllRegions: true }),
    );

    const enabled = (regionsRes.Regions || [])
      .filter((r) => {
        const status = String(
          r.OptInStatus || "opt-in-not-required",
        ).toLowerCase();
        return status === "opted-in" || status === "opt-in-not-required";
      })
      .map((r) => r.RegionName)
      .filter((r): r is string => Boolean(r));

    const regions = enabled.filter((r) => STATIC_DISCOVERY_REGIONS.includes(r));
    const finalRegions = regions.length > 0 ? regions : STATIC_DISCOVERY_REGIONS;
    enabledRegionCache.set(key, { regions: finalRegions, timestamp: Date.now() });
    return finalRegions;
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        "[Resources] Dynamic region discovery failed. Falling back to static list:",
        e?.message || e,
      );
    }
    enabledRegionCache.set(key, {
      regions: STATIC_DISCOVERY_REGIONS,
      timestamp: Date.now(),
    });
    return STATIC_DISCOVERY_REGIONS;
  }
}

interface InventoryCacheEntry {
  promise: Promise<ResourceInventory>;
  timestamp: number;
}
const inventoryCache = new Map<string, InventoryCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getResourceInventory(
  workspaceId: string,
  region: string = DEFAULT_REGION,
  roleArn?: string,
  externalId?: string,
  forceRefresh: boolean = false,
): Promise<ResourceInventory> {
  const cacheKey = `${workspaceId}:${region}:${roleArn || "default"}`;
  const now = Date.now();
  const cached = inventoryCache.get(cacheKey);

  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = executeResourceInventory(
    workspaceId,
    region,
    roleArn,
    externalId,
  );
  inventoryCache.set(cacheKey, { promise, timestamp: now });

  try {
    await promise;
  } catch {
    inventoryCache.delete(cacheKey);
  }

  return promise;
}
