import LiveCanvasServicePage from "./LiveCanvasServicePage";
import { FeatureLockedGate } from "@/modules/admin";

export default function Page({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  return (
    <FeatureLockedGate feature="simulations" featureLabel="Simulations">
      <LiveCanvasServicePage params={params} />
    </FeatureLockedGate>
  );
}
