import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GlobalAiAgentWidget } from "@/components/chat/GlobalAiAgentWidget";
import { DocsStateProvider } from "@/components/docs/DocsStateProvider.client";

const BRAND_NAME = "Cloudcam";

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} Docs | Cloud Cost Optimization, Multicloud Monitoring, and AI Observability`,
    template: `%s | ${BRAND_NAME} Docs`,
  },
  description: `Cloudcam docs for multicloud onboarding, billing, alerts, AI observability, simulations, reports, migration, troubleshooting, and FAQ.`,
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    type: "website",
    url: "/docs",
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} Docs | Cloud Cost Optimization and Multicloud Guides`,
    description:
      "Read Cloudcam documentation for multicloud onboarding, cloud cost management, AI observability, alerts, simulations, reports, migration, and troubleshooting.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cloudcam documentation for cloud cost optimization and multicloud monitoring",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} Docs | Cloud Cost Optimization Guides`,
    description:
      "Cloudcam documentation for multicloud setup, cost optimization, AI observability, simulations, and monitoring workflows.",
    images: ["/opengraph-image"],
  },
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsStateProvider>
      {children}
      <GlobalAiAgentWidget />
    </DocsStateProvider>
  );
}
