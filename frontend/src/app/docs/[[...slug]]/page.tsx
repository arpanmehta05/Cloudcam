import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Cloud, Eye, LifeBuoy } from "@/icons";
import { DocsFrame } from "@/components/docs/DocsFrame";
import {
  docsPages,
  getDocsNeighbors,
  getDocsPageBySlug,
  normalizeDocsPath,
} from "@/lib/docs-content";

const BRAND_NAME = "Cloudcam";

const homeHighlights = [
  {
    title: "Multicloud setup",
    description:
      "Connect AWS, Azure, or GCP and understand which capabilities are ready for each provider.",
    icon: Cloud,
  },
  {
    title: "Operational visibility",
    description:
      "Use dashboards, Watchdog, alerts, logs, savings, reports, and AI observability to spot issues early.",
    icon: Eye,
  },
  {
    title: "Safe changes",
    description:
      "Plan simulations, review live infrastructure, and run resize migrations with explicit safety checks.",
    icon: LifeBuoy,
  },
];

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateStaticParams() {
  return docsPages
    .filter((page) => page.slug.length > 0)
    .map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocsPageBySlug(slug);
  const canonicalPath = page?.path ?? "/docs";
  const title = page
    ? page.path === "/docs"
      ? `${BRAND_NAME} Documentation | Cloud Cost Optimization and Multicloud Docs`
      : `${page.label} | ${BRAND_NAME} Docs`
    : `${BRAND_NAME} Docs`;
  const description =
    page?.description ??
    "Cloudcam documentation for multicloud onboarding, cloud cost optimization, monitoring, AI observability, simulations, reports, migration, and troubleshooting.";

  return {
    title: {
      absolute: title,
    },
    description,
    keywords: [
      "Cloudcam docs",
      "Cloudcam documentation",
      "cloud cost optimization docs",
      "multicloud monitoring documentation",
      "AI observability docs",
      "AWS EC2 S3 RDS Lambda ECS EKS CloudFront documentation",
      "Azure VM Storage Account Azure SQL AKS Function App documentation",
      "GCP Compute Engine Cloud Storage Cloud SQL GKE Cloud Run documentation",
      "Terraform cloud simulation documentation",
      "cloud provider configuration guide",
      page?.label ?? "Cloudcam",
      page?.group ?? "Cloudcam docs",
    ],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "article",
      url: canonicalPath,
      siteName: BRAND_NAME,
      title,
      description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${BRAND_NAME} documentation`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function DocsPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = getDocsPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const { prev, next } = getDocsNeighbors(normalizeDocsPath(slug));
  const pageUrl = `https://cloudcam.fonder.tech${page.path}`;
  const docsStructuredData = [
    {
      "@context": "https://schema.org",
      "@type": page.slug.length === 0 ? "CollectionPage" : "TechArticle",
      "@id": `${pageUrl}#docs-page`,
      headline: page.title,
      name: page.title,
      description: page.description,
      url: pageUrl,
      isPartOf: {
        "@type": "WebSite",
        "@id": "https://cloudcam.fonder.tech/#website",
        name: "Cloudcam",
      },
      about: [
        "Cloudcam documentation",
        page.group,
        page.label,
      ],
      publisher: {
        "@type": "Organization",
        "@id": "https://cloudcam.fonder.tech/#organization",
        name: "Cloudcam",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Cloudcam",
          item: "https://cloudcam.fonder.tech/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Docs",
          item: "https://cloudcam.fonder.tech/docs",
        },
        ...(page.slug.length > 0
          ? [
              {
                "@type": "ListItem",
                position: 3,
                name: page.label,
                item: pageUrl,
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <>
      {docsStructuredData.map((item) => (
        <script
          key={String(item["@type"])}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <DocsFrame page={page} prev={prev} next={next}>
        {page.slug.length === 0 ? (
          <div className="mt-8">
            <div className="mb-8 rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold leading-6 text-[#475569]">
                These Cloudcam docs
                help engineering teams set up multicloud monitoring, understand
                cloud cost optimization workflows, trace AI spend, and
                troubleshoot billing, alerts, simulations, reports, migrations,
                and infrastructure visibility.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {homeHighlights.map((item) => (
                <div
                  key={item.title}
                  className="border-t border-[#D8E1F0] pt-5 transition-transform duration-200 ease-out hover:-translate-y-1"
                >
                  <item.icon className="h-5 w-5 text-[#1A56DB]" />
                  <p className="mt-3 text-lg font-semibold tracking-tight text-[#0F172A]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#64748B]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-8 border-t border-[#E8EDF5] pt-8 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-[#1A56DB]">
                  Start here
                </p>
                <div className="mt-4 space-y-4">
                  {[
                    {
                      href: "/docs/getting-started",
                      title: "Getting started",
                      body: "The fastest path from signup to useful product visibility across cloud and AI workflows.",
                    },
                    {
                      href: "/docs/local-development-setup",
                      title: "Local Setup Guide",
                      body: "Step-by-step instructions to set up the entire backend, frontend, database, and telemetry locally.",
                    },
                    {
                      href: "/docs/feature-catalog",
                      title: "Feature catalog",
                      body: "A complete map of product features, app pages, operational workflows, and integration areas.",
                    },
                    {
                      href: "/docs/app-pages",
                      title: "App pages",
                      body: "A route-by-route explanation of every major Cloudcam page and what it is used for.",
                    },
                    {
                      href: "/docs/api-reference",
                      title: "API reference",
                      body: "A developer-readable map of backend API groups for cloud, AI, simulations, actions, logs, reports, and DPDP.",
                    },
                    {
                      href: "/docs/ai-quality-workflows",
                      title: "AI quality workflows",
                      body: "Use evaluations, scores, sessions, users, and trace review workflows.",
                    },
                    {
                      href: "/docs/multicloud-setup",
                      title: "Multicloud setup",
                      body: "Understand AWS, Azure, and GCP connection state, capabilities, and provider switching.",
                    },
                    {
                      href: "/docs/supported-cloud-services",
                      title: "Supported cloud services",
                      body: "See the AWS, Azure, and GCP services Cloudcam can monitor, simulate, configure, or deploy.",
                    },
                    {
                      href: "/docs/cloud-provider-configurations",
                      title: "Provider configurations",
                      body: "Review the IAM role, service principal, service account, region, billing, Terraform, and node configuration fields.",
                    },
                    {
                      href: "/docs/service-configuration-reference",
                      title: "Service configuration reference",
                      body: "Read every supported AWS, Azure, GCP, GitHub, Docker, network, storage, compute, database, and serverless config field.",
                    },
                    {
                      href: "/docs/azure-setup",
                      title: "Azure setup",
                      body: "Connect Azure and understand current dashboard, simulation, billing, and permission coverage.",
                    },
                    {
                      href: "/docs/gcp-setup",
                      title: "GCP setup",
                      body: "Connect a GCP project with service-account setup and callback-aware onboarding.",
                    },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group block border-b border-[#EEF2F7] pb-4 transition-transform duration-200 ease-out hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-[#0F172A] transition-colors group-hover:text-[#1A56DB]">
                            {item.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#64748B]">
                            {item.body}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1A56DB]" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-[#1A56DB]">
                  Popular topics
                </p>
                <div className="mt-4 space-y-4">
                  {[
                    {
                      href: "/docs/alerts-notifications",
                      title: "Alerts & notifications",
                      body: "Review cloud, AI, and VPS signals with provider-aware alerting notes.",
                    },
                    {
                      href: "/docs/ai-observability",
                      title: "AI observability",
                      body: "Track model usage, reliability, and AI-related cost changes.",
                    },
                    {
                      href: "/docs/ai-playground-evaluations",
                      title: "Playground & Evals",
                      body: "Run side-by-side prompt testing, configure custom LLM judges, and inspect error responses.",
                    },
                    {
                      href: "/docs/simulation-features",
                      title: "Simulation mode",
                      body: "Build AWS, Azure, and GCP simulation canvases and preview Terraform before deployment.",
                    },
                    {
                      href: "/docs/resize-migration",
                      title: "Resize migration",
                      body: "Plan right-size moves with source, target, validation, cutover, and rollback-aware steps.",
                    },
                    {
                      href: "/docs/email-reports",
                      title: "Email reports",
                      body: "Configure report cadence, recipients, sections, and test PDF delivery.",
                    },
                    {
                      href: "/docs/troubleshooting",
                      title: "Troubleshooting",
                      body: "Work through the most common onboarding and empty-state issues.",
                    },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group block border-b border-[#EEF2F7] pb-4 transition-transform duration-200 ease-out hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-[#0F172A] transition-colors group-hover:text-[#1A56DB]">
                            {item.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#64748B]">
                            {item.body}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1A56DB]" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DocsFrame>
    </>
  );
}
