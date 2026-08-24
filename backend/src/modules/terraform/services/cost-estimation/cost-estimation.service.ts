import { CostEstimationRequest, CostEstimationResult } from "./types";
import { cacheKeyFor, getCached, setCached } from "./cache";
import { collectUnsupportedWarnings } from "./helpers";
import { hasInfracost, estimateWithInfracost } from "./infracost-engine";
import { estimateWithPriceList } from "./price-list-engine";

export * from "./types";

/**
 * Orchestrates cost estimation by checking the query cache, checking if Infracost CLI is available,
 * running the appropriate estimation engine, appending compatibility warnings, and saving to the cache.
 */
export async function estimateCost(
  request: CostEstimationRequest,
): Promise<CostEstimationResult> {
  const cacheKey = cacheKeyFor(request);
  const cached = getCached(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  let result: CostEstimationResult;

  if (hasInfracost()) {
    result = await estimateWithInfracost(request);
  } else {
    result = await estimateWithPriceList(request);
  }

  // Add unsupported config warnings
  result.warnings.push(...collectUnsupportedWarnings(request));

  setCached(cacheKey, result);
  return { ...result, cached: false };
}
