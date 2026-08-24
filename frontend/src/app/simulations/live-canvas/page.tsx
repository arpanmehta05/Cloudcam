"use client";
import { LiveCanvasPage } from "@/modules/simulation";
import { FeatureLockedGate } from "@/modules/admin";

export default function LiveCanvasRoute() {
  return (
    <FeatureLockedGate feature="simulations" featureLabel="Simulations">
      <LiveCanvasPage />
    </FeatureLockedGate>
  );
}
