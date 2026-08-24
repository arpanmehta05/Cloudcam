"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Scoped TanStack Query provider for the AI Observability area. Kept local to
 * this route segment so the rest of the app is untouched. Queries stay fresh
 * for 15s and refetch on window focus; mutations invalidate the relevant keys
 * so views (Trace Explorer table, trace detail, Lineage) update live without a
 * manual refresh.
 */
export function AiObservabilityQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
