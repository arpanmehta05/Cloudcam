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

const BRAND_NAME = "Cloudcam";
const BRAND_SUBTITLE = "By Fonder";
const SITE_URL = "https://cloudcam.fonder.tech";

const faqs = [
  {
    question: "What is Cloudcam?",
    answer:
      "Cloudcam is an engineering-first cloud cost optimization and observability platform. It helps engineering, DevOps, and FinOps teams monitor multi-cloud infrastructure, reduce waste, analyze AI model spend, and automate savings recommendations in real-time.",
  },
  {
    question: "What is Cloudcam?",
    answer:
      "Cloudcam is the product platform for cloud cost optimization, monitoring, and AI observability.",
  },
  {
    question: "How does Cloudcam help reduce cloud costs?",
    answer:
      "Cloudcam continuously scans your cloud infrastructure for idle databases, unattached storage, and oversized instances. It then provides actionable, safe optimization recommendations (like right-sizing and reservations) with built-in Terraform previews and simulation dry-runs.",
  },
  {
    question: "Who should use Cloudcam?",
    answer:
      "Cloudcam is built for modern engineering teams, DevOps engineers, and FinOps leaders who want cost visibility and optimization workflows integrated directly into their existing developer workflows, rather than locked inside isolated finance tools.",
  },
];

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: BRAND_NAME,
    url: `${SITE_URL}/`,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Cloud cost management software",
    operatingSystem: "Web",
    description:
      "Cloudcam is a cloud cost intelligence platform for AWS cost optimization, multicloud monitoring, AI observability, simulations, and engineering-led FinOps workflows.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free signup available for teams evaluating Cloudcam.",
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
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/Logo.svg`,
    description:
      "Cloudcam is a cloud cost management, multicloud monitoring, and AI observability platform by Fonder.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BRAND_NAME,
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
    `${BRAND_NAME} is a cloud cost intelligence platform by ${BRAND_SUBTITLE.replace("By ", "")} for AWS cost optimization, multicloud monitoring, AI observability, simulations, and engineering-led FinOps workflows.`,
  keywords: [
    "Cloudcam",
    "Cloudcam AWS",
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
      "Cloudcam combines cloud cost optimization, multicloud monitoring, AI observability, simulations, and FinOps workflows in one platform.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cloudcam cloud cost optimization and monitoring platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Cloud Cost Optimization and Multicloud Monitoring`,
    description:
      "Cloudcam helps engineering teams reduce cloud spend, monitor infrastructure, and trace AI costs.",
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
