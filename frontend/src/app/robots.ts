import type { MetadataRoute } from "next";

const siteUrl = "https://cloudcam.fonder.tech";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/plans", "/docs", "/docs/"],
        disallow: [
          "/actions",
          "/ai-observability",
          "/api",
          "/cost-savings",
          "/dashboard",
          "/dashboards",
          "/dpdp-compliance",
          "/forgot-password",
          "/oauth",
          "/profile",
          "/recommendations",
          "/reset-password",
          "/resize-migration",
          "/services",
          "/settings",
          "/simulation",
          "/simulations",
          "/verify-signup",
          "/vps-logs",
          "/watchdog",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
