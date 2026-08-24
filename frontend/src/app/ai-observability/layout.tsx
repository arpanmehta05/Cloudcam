import { AiObservabilityQueryProvider } from "./QueryProvider";
import { FeatureLockedGate } from "@/modules/admin";

export default function AiObservabilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeatureLockedGate feature="ai_observability" featureLabel="AI Observability">
      <AiObservabilityQueryProvider>{children}</AiObservabilityQueryProvider>
    </FeatureLockedGate>
  );
}
