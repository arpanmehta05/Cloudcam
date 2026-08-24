import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { RegionProvider } from "@/context/RegionContext";
import { AuthGuard } from "@/core/layout/AuthGuard";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";

const sansFont = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

const BRAND_NAME = "CloudWatcher";
const BRAND_SUBTITLE = "By Rabbitt Ai";
const SITE_URL = "https://cloudwatcher.rabbitt.ai";

const faqs = [
  {
    question: "What is CloudWatcher?",
    answer:
      "CloudWatcher is an engineering-first cloud cost optimization and observability platform. It helps engineering, DevOps, and FinOps teams monitor multi-cloud infrastructure, reduce waste, analyze AI model spend, and automate savings recommendations in real-time.",
  },
  {
    question: "Is CloudWatcher the same product as Rabbittize?",
    answer:
      "Yes. CloudWatcher is the official product platform name, and it is hosted at the rabbitt.ai domain. The platform has been upgraded and fully optimized to support legacy Rabbittize integrations alongside all new CloudWatcher FinOps capabilities.",
  },
  {
    question: "How does CloudWatcher help reduce cloud costs?",
    answer:
      "CloudWatcher continuously scans your cloud infrastructure for idle databases, unattached storage, and oversized instances. It then provides actionable, safe optimization recommendations (like right-sizing and reservations) with built-in Terraform previews and simulation dry-runs.",
  },
  {
    question: "Who should use CloudWatcher?",
    answer:
      "CloudWatcher is built for modern engineering teams, DevOps engineers, and FinOps leaders who want cost visibility and optimization workflows integrated directly into their existing developer workflows, rather than locked inside isolated finance tools.",
  },
];

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: BRAND_NAME,
    alternateName: ["Rabbittize", "Rabbittize CloudWatcher"],
    url: `${SITE_URL}/`,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Cloud cost management software",
    operatingSystem: "Web",
    description:
      "CloudWatcher, also known as Rabbittize, is a cloud cost intelligence platform for AWS cost optimization, multicloud monitoring, AI observability, simulations, and engineering-led FinOps workflows.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free signup available for teams evaluating CloudWatcher.",
    },
    featureList: [
      "AWS cost optimization software",
      "Cloud cost management platform for engineering teams",
      "Multicloud infrastructure monitoring",
      "AI observability and model cost tracking",
      "FinOps workflows with ownership context",
      "Cost reports, alerts, simulations, and recommendations",
    ],
    creator: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: BRAND_NAME,
      alternateName: "Rabbittize",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    alternateName: "Rabbittize",
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/Logo.svg`,
    description:
      "CloudWatcher is a cloud cost management, multicloud monitoring, and AI observability platform by Rabbitt Ai.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BRAND_NAME,
    alternateName: "Rabbittize",
    url: `${SITE_URL}/`,
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  },
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND_NAME,
  title: {
    default: `${BRAND_NAME} | Cloud Cost Optimization and Multicloud Monitoring Platform`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    `${BRAND_NAME}, also known as Rabbittize, is a cloud cost intelligence platform by ${BRAND_SUBTITLE.replace("By ", "")} for AWS cost optimization, multicloud monitoring, AI observability, simulations, and engineering-led FinOps workflows.`,
  keywords: [
    "CloudWatcher",
    "Rabbittize",
    "CloudWatcher AWS",
    "Rabbittize AWS",
    "AWS cost management",
    "AWS cost optimization software",
    "cloud cost optimization",
    "cloud cost management platform",
    "multicloud monitoring",
    "FinOps platform",
    "AWS monitoring",
    "AWS infrastructure monitoring",
    "cloud infrastructure",
    "cost intelligence",
    "CloudWatch dashboard",
    "EC2 monitoring",
    "Kubernetes cost",
    "AI cloud optimization",
    "Gemini AI",
    "cloud security",
    "GuardDuty",
    "cloud spend",
    "engineering teams",
  ],
  alternates: {
    canonical: "/",
  },
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  category: "Cloud cost management software",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} | Cloud Cost Optimization and Multicloud Monitoring`,
    description:
      "CloudWatcher, also known as Rabbittize, combines cloud cost optimization, multicloud monitoring, AI observability, simulations, and FinOps workflows in one platform.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "CloudWatcher cloud cost optimization and monitoring platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Cloud Cost Optimization and Multicloud Monitoring`,
    description:
      "CloudWatcher, also known as Rabbittize, helps engineering teams reduce cloud spend, monitor infrastructure, and trace AI costs.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {structuredData.map((item) => (
          <script
            key={String(item["@type"])}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
          />
        ))}
      </head>
      <body
        className={`${sansFont.variable} min-h-screen`}
      >
        <SmoothScrollProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <AuthProvider>
              <RegionProvider>
                <AuthGuard>
                  {children}
                </AuthGuard>
              </RegionProvider>
            </AuthProvider>
          </ThemeProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
