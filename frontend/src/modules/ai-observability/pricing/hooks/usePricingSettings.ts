"use client";

import { useEffect, useState } from "react";
import {
  pricingApi,
  type CustomModelPrice,
  type UnpricedModelRow,
} from "../api";

export function usePricingSettings() {
  const [prices, setPrices] = useState<CustomModelPrice[]>([]);
  const [unpricedModels, setUnpricedModels] = useState<UnpricedModelRow[]>([]);

  useEffect(() => {
    Promise.all([
      pricingApi.listCustomPrices(),
      pricingApi.listUnpricedModels(),
    ])
      .then(([nextPrices, nextUnpriced]) => {
        setPrices(nextPrices);
        setUnpricedModels(nextUnpriced);
      })
      .catch(() => {
        setPrices([]);
        setUnpricedModels([]);
      });
  }, []);

  return { prices, unpricedModels };
}
