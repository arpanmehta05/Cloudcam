export const AI_SOURCE_TYPES = [
  "vendor_api",
  "cloud_managed",
  "self_hosted",
  "instrumented_app",
] as const;
export type AiSourceType = (typeof AI_SOURCE_TYPES)[number];

export const AI_VENDOR_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "mistral",
  "custom",
] as const;
export type AiVendorProvider = (typeof AI_VENDOR_PROVIDERS)[number];

export const AI_CLOUD_PROVIDERS = [
  "bedrock",
  "vertex",
  "azure_openai",
] as const;
export type AiCloudProvider = (typeof AI_CLOUD_PROVIDERS)[number];

export const AI_SELF_HOSTED_TARGETS = [
  "ec2_vllm",
  "eks_vllm",
  "ec2_tgi",
  "eks_tgi",
  "ollama",
  "custom_endpoint",
] as const;
export type AiSelfHostedTarget = (typeof AI_SELF_HOSTED_TARGETS)[number];

export const AI_ENVIRONMENTS = ["prod", "staging", "dev"] as const;
export type AiEnvironment = (typeof AI_ENVIRONMENTS)[number];

export const AI_BILLING_CURRENCIES = ["USD", "INR", "EUR", "GBP"] as const;
export type AiBillingCurrency = (typeof AI_BILLING_CURRENCIES)[number];

export const AI_PII_POLICIES = ["none", "redact", "hash", "block"] as const;
export type AiPiiPolicy = (typeof AI_PII_POLICIES)[number];

export const AI_REQUIRED_EVENT_FIELDS = [
  "tenantId",
  "workspaceId",
  "environment",
  "serviceName",
  "endpoint",
  "requestId",
] as const;
export type AiRequiredEventField = (typeof AI_REQUIRED_EVENT_FIELDS)[number];
