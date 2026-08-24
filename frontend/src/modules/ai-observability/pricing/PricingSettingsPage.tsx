"use client";

import { ObservabilityPageShell, money } from "../shared/ObservabilityPageShell";
import { CustomPricesList } from "./components/CustomPricesList";
import { UnpricedModelsPanel } from "./components/UnpricedModelsPanel";
import { usePricingSettings } from "./hooks/usePricingSettings";

export default function PricingSettingsPage() {
  const { prices, unpricedModels } = usePricingSettings();

  return (
    <ObservabilityPageShell title="Custom Pricing" subtitle="Workspace-specific model pricing overrides used by cost attribution.">
      <UnpricedModelsPanel unpricedModels={unpricedModels} />
      <CustomPricesList prices={prices} money={money} />
    </ObservabilityPageShell>
  );
}
