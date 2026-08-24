import dotenv from "dotenv";
import path from "path";

// PM2/Node process cwd may not be the backend folder in production.
// Resolve .env relative to this file so env loading is deterministic.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const env = (primary: string, legacy?: string, fallback = "") => {
  return (
    process.env[primary] ||
    (legacy ? process.env[legacy] : undefined) ||
    fallback
  );
};

const appEnvRaw = env("APP_ENV", "NODE_ENV", "development")
  .toLowerCase()
  .trim();
const isProductionEnv = appEnvRaw === "production";
const isStagingEnv = appEnvRaw === "staging";

function resolveApiBaseUrl(): string {
  if (isProductionEnv) return "https://rabbitize-api.rabbitt.ai";
  if (isStagingEnv) {
    return env(
      "STAGING_API_BASE_URL",
      "PUBLIC_API_BASE_URL",
      "http://stagingrabbitt.duckdns.org",
    ).replace(/\/+$/, "");
  }
  return env("PUBLIC_API_BASE_URL", undefined, "http://localhost:4000").replace(
    /\/+$/,
    "",
  );
}

const resolvedBaseUrl = resolveApiBaseUrl();

export const config = {
  appEnv: appEnvRaw,
  isProduction: isProductionEnv,
  port: parseInt(process.env.PORT || "4000", 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || "180000", 10),
  providerSyncTimeoutMs: parseInt(
    process.env.PROVIDER_SYNC_TIMEOUT_MS || "30000",
    10,
  ),
  publicApiBaseUrl: resolvedBaseUrl,
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => {
      const trimmed = o.trim();
      // Ensure protocol prefix
      return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    }),

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize",

  // JWT
  jwtSecret:
    process.env.JWT_SECRET || "rabbittize-dev-secret-change-in-production",

  // Prometheus
  prometheusUrl: process.env.PROMETHEUS_URL || "http://localhost:9090",

  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",

  // AWS Master Account (for STS AssumeRole)
  aws: {
    region: process.env.AWS_REGION || "ap-south-1",
    masterRegion: env("RABBITTIZE_MASTER_REGION", undefined, "us-east-1"),
    masterAccessKeyId:
      env("RABBITTIZE_MASTER_ACCESS_KEY_ID") ||
      process.env.AWS_ACCESS_KEY_ID ||
      "",
    masterSecretAccessKey:
      env("RABBITTIZE_MASTER_SECRET_ACCESS_KEY") ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      "",
  },

  // Azure app registration defaults for future onboarding and API access.
  azure: {
    defaultRegion: process.env.AZURE_DEFAULT_REGION || "centralindia",
    tenantId: env("AZURE_TENANT_ID"),
    clientId: env("AZURE_CLIENT_ID"),
    clientSecret: env("AZURE_CLIENT_SECRET"),
    subscriptionId: env("AZURE_SUBSCRIPTION_ID"),
    authorityHost:
      process.env.AZURE_AUTHORITY_HOST || "https://login.microsoftonline.com",
    // Falls back to resolvedBaseUrl so the correct env URL is used automatically.
    templateUrl: env(
      "AZURE_TEMPLATE_URL",
      undefined,
      `${resolvedBaseUrl}/api/azure/template`,
    ),
    webhookUrl: env(
      "AZURE_WEBHOOK_URL",
      undefined,
      `${resolvedBaseUrl}/api/azure/save-connection`,
    ),
    webhookSecret: env("AZURE_WEBHOOK_SECRET", "RABBITTIZE_WEBHOOK_SECRET"),
  },

  gcp: {
    webhookUrl: env(
      "GCP_WEBHOOK_URL",
      undefined,
      `${resolvedBaseUrl}/api/gcp/save-connection`,
    ),
  },

  fargate: {
    region:
      process.env.FARGATE_REGION || process.env.AWS_REGION || "eu-north-1",
    cluster: process.env.FARGATE_CLUSTER || "rabbittize-simulations",
    taskDefinition:
      process.env.FARGATE_TASK_DEFINITION || "rabbittize-terraform-runner",
    // Task definition for GCP runner. Falls back to taskDefinition to share the unified runner.
    gcpTaskDefinition:
      process.env.FARGATE_GCP_TASK_DEFINITION ||
      process.env.FARGATE_TASK_DEFINITION ||
      "rabbittize-terraform-runner",
    containerName: process.env.FARGATE_CONTAINER_NAME || "terraform-runner",
    logGroup:
      process.env.FARGATE_LOG_GROUP || "/ecs/rabbittize-terraform-runner",
    logStreamPrefix: process.env.FARGATE_LOG_STREAM_PREFIX || "ecs",
    artifactBucket: process.env.FARGATE_ARTIFACT_BUCKET || "",
    // Separate S3 bucket for GCP runner artifacts. Falls back to artifactBucket if not set.
    gcpArtifactBucket:
      process.env.FARGATE_GCP_ARTIFACT_BUCKET ||
      process.env.FARGATE_ARTIFACT_BUCKET ||
      "",
    artifactPrefix: process.env.FARGATE_ARTIFACT_PREFIX || "terraform-runs",
    subnets: (
      process.env.FARGATE_SUBNETS ||
      "subnet-0252ac31a39faf29b,subnet-0ffc1e4648da3a4ea"
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    securityGroups: (
      process.env.FARGATE_SECURITY_GROUPS || "sg-09aa39a5bc7013798"
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    assignPublicIp:
      (process.env.FARGATE_ASSIGN_PUBLIC_IP || "true").toLowerCase() !==
      "false",
    // Staging / dev toggle: set SIMULATION_USE_ECS=true (or RUNNER_USE_FARGATE=true)
    // to route simulation containers through ECS Fargate without requiring APP_ENV=production.
    useEcs:
      process.env.SIMULATION_USE_ECS === "true" ||
      process.env.RUNNER_USE_FARGATE === "true",
  },

  // Rabbittize CloudFormation
  rabbittize: {
    trustRoleArn: env("RABBITTIZE_TRUST_ROLE_ARN", undefined, "767397861361"),
    pingbackArn: env(
      "RABBITTIZE_PINGBACK_ARN",
      undefined,
      "arn:aws:sns:us-east-1:767397861361:rabbittize-customer-pingbacks",
    ),
    templateUrl:
      process.env.NEXT_PUBLIC_TEMPLATE_URL ||
      "https://rabbittize-cf-templates.s3.us-east-1.amazonaws.com/rabbittize-aws-integration.json",
    apiSecret: env("RABBITTIZE_API_SECRET"),
    webhookUrl: env(
      "RABBITTIZE_WEBHOOK_URL",
      undefined,
      `${resolvedBaseUrl}/api/webhook`,
    ),
    webhookSecret: env("RABBITTIZE_WEBHOOK_SECRET"),
  },

  // AI Observability Feature Flags
  aiObservability: {
    enabled: process.env.AI_OBSERVABILITY_ENABLED !== "false",
    bedrockMonitoring: process.env.BEDROCK_MONITORING_ENABLED !== "false",
    logForwarderSecret: process.env.LOG_FORWARDER_SECRET || "",
    cronEnabled: process.env.AI_CRON_ENABLED !== "false",
  },

  // OAuth Providers
  oauth: {
    google: {
      clientId: env("GOOGLE_OAUTH_CLIENT_ID"),
      clientSecret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
    },
    github: {
      clientId: isProductionEnv
        ? env("GITHUB_OAUTH_CLIENT_ID_PRODUCTION", "GITHUB_OAUTH_CLIENT_ID")
        : env("GITHUB_OAUTH_CLIENT_ID_DEVELOPMENT", "GITHUB_OAUTH_CLIENT_ID"),
      clientSecret: isProductionEnv
        ? env(
            "GITHUB_OAUTH_CLIENT_SECRET_PRODUCTION",
            "GITHUB_OAUTH_CLIENT_SECRET",
          )
        : env(
            "GITHUB_OAUTH_CLIENT_SECRET_DEVELOPMENT",
            "GITHUB_OAUTH_CLIENT_SECRET",
          ),
    },
  },

  // Action Engine
  actionMode: (process.env.ACTION_MODE || "simulation") as
    | "simulation"
    | "live",

  // Email Notifications (optional)
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "noreply@rabbittize.com",
  },
};
