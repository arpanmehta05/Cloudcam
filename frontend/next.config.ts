import type { NextConfig } from "next";
import path from "path";

// Resolve environment: prefer NEXT_PUBLIC_APP_ENV (set on Amplify), fall back to NODE_ENV.
const appEnv = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";

// Allow a direct backend URL override (useful for staging / preview environments
// where the URL is injected as a build-time Amplify env var).
// Otherwise derive it from appEnv.
function resolveBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    // Strip trailing slash so destination paths compose correctly.
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "");
  }
  if (appEnv === "production") return "https://rabbitize-api.rabbitt.ai";
  if (appEnv === "staging")    return "http://stagingrabbitt.duckdns.org";
  return "http://localhost:4000";
}

const backendBaseUrl = resolveBackendUrl();

console.log(`[next.config] Environment: ${appEnv} → backend: ${backendBaseUrl}`);

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve("."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
