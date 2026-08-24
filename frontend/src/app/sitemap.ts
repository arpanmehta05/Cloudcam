import type { MetadataRoute } from "next";
import { docsPages } from "@/lib/docs-content";

const siteUrl = "https://cloudwatcher.rabbitt.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/plans`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    ...docsPages.map((page) => ({
      url: `${siteUrl}${page.path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: page.path === "/docs" ? 0.8 : 0.65,
    })),
  ];
}
