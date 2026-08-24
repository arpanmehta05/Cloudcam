import { AI_OBSERVABILITY_BASE, fetchAiJson } from "../api/http";
import type { CustomModelPrice, UnpricedModelRow } from "../api/types";

export type { CustomModelPrice, UnpricedModelRow };

export async function listCustomPrices(): Promise<CustomModelPrice[]> {
  const data = await fetchAiJson<{ success: boolean; prices: CustomModelPrice[] }>(`${AI_OBSERVABILITY_BASE}/custom-pricing`);
  return data.prices || [];
}

export async function listUnpricedModels(): Promise<UnpricedModelRow[]> {
  const data = await fetchAiJson<{ success: boolean; models: UnpricedModelRow[] }>(`${AI_OBSERVABILITY_BASE}/custom-pricing/unpriced`);
  return data.models || [];
}

export const pricingApi = {
  listCustomPrices,
  listUnpricedModels,
};
