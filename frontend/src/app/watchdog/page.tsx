"use client";
import { WatchdogPage } from "@/modules/watchdog";
import { FeatureLockedGate } from "@/modules/admin";

export default function WatchdogRoute() {
  return (
    <FeatureLockedGate feature="watchdog" featureLabel="Watchdog">
      <WatchdogPage />
    </FeatureLockedGate>
  );
}
