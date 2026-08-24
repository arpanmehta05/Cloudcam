import { z } from "zod";
import { ServiceDefinition } from "./common.registry";
import { VpcConfigSchema } from "./aws.registry";

export const GcpComputeConfigSchema = z.object({
  instanceName: z.string().default("sim-gce"),
  machineType: z.string().default("e2-micro"),
  zone: z.string().default("us-central1-a"),
  image: z.string().default("projects/debian-cloud/global/images/family/debian-12"),
  bootDiskGb: z.coerce.number().int().min(10).max(65536).default(20),
  allowHttp: z.boolean().default(true),
  region: z.string().default("us-central1"),
});

export const GcpStorageConfigSchema = z.object({
  bucketName: z.string().default("sim-gcs-bucket"),
  storageClass: z.string().default("STANDARD"),
  location: z.string().default("US"),
  versioning: z.boolean().default(false),
  region: z.string().default("us-central1"),
  policy: z.string().default(""),
});

export const GcpSqlConfigSchema = z.object({
  instanceName: z.string().default("sim-cloudsql"),
  databaseName: z.string().default("simdb"),
  databaseVersion: z.string().default("POSTGRES_16"),
  tier: z.string().default("db-f1-micro"),
  region: z.string().default("us-central1"),
});

export const GcpFunctionConfigSchema = z.object({
  functionName: z.string().default("sim-function"),
  runtime: z.string().default("nodejs20"),
  entryPoint: z.string().default("helloHttp"),
  region: z.string().default("us-central1"),
});

export const GcpVpcConfigSchema = z.object({
  networkName: z.string().default("sim-vpc-network"),
  cidrBlock: z.string().default("10.0.0.0/16"),
  subnetCidrBlock: z.string().default("10.0.1.0/24"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
  httpsPort: z.coerce.number().int().min(1).max(65535).default(443),
  isPrivate: z.boolean().default(false),
  region: z.string().default("us-central1"),
});

export const GcpArtifactRegistryConfigSchema = z.object({
  repositoryMode: z.enum(["new", "existing"]).default("new"),
  repositoryId: z.string().default("sim-repo"),
  format: z.string().default("DOCKER"),
  description: z.string().default("Simulation Artifact Registry"),
  existingRepositoryUrl: z.string().default("").optional(),
  imageTag: z.string().default("latest").optional(),
  region: z.string().default("us-central1"),
});

export const GcpIpPlaceholderSchema = z.object({
  name: z.string().default("sim-ip"),
  region: z.string().default("us-central1"),
});

const SecurityRuleSchema = z.object({
  type: z.enum(["ingress", "egress"]).default("ingress"),
  fromPort: z.coerce.number().int().min(1).max(65535).default(80),
  toPort: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("tcp"),
  cidrBlocks: z.string().default("0.0.0.0/0"),
});

export const GcpFirewallConfigSchema = z.object({
  name: z.string().default("sim-firewall"),
  description: z.string().default("Managed firewall rules"),
  region: z.string().default("us-central1"),
  rules: z.array(SecurityRuleSchema).default([
    { type: "ingress", fromPort: 80, toPort: 80, protocol: "tcp", cidrBlocks: "0.0.0.0/0" },
    { type: "ingress", fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: "0.0.0.0/0" }
  ]),
});

export const GcpTgConfigSchema = z.object({
  name: z.string().default("sim-gcp-tg"),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("HTTP"),
  region: z.string().default("us-central1"),
});

export const GcpDiskConfigSchema = z.object({
  diskName: z.string().default("sim-gcp-disk"),
  sizeGb: z.coerce.number().int().min(10).max(65536).default(30),
  diskType: z.string().default("pd-standard"),
  region: z.string().default("us-central1"),
});

export const GcpLbConfigSchema = z.object({
  lbName: z.string().default("sim-glb"),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  region: z.string().default("us-central1"),
});

export const GcpMigConfigSchema = z.object({
  minSize: z.coerce.number().int().min(0).max(100).default(1),
  maxSize: z.coerce.number().int().min(1).max(100).default(3),
  desiredCapacity: z.coerce.number().int().min(0).max(100).default(1),
  instanceName: z.string().default("sim-mig"),
  machineType: z.string().default("e2-micro"),
  zone: z.string().default("us-central1-a"),
  image: z.string().default("projects/debian-cloud/global/images/family/debian-12"),
  bootDiskGb: z.coerce.number().int().min(10).max(65536).default(20),
  allowHttp: z.boolean().default(true),
  region: z.string().default("us-central1"),
  cpuTarget: z.coerce.number().int().min(10).max(100).default(60),
});

export const GcpCdnConfigSchema = z.object({
  cdnName: z.string().default("sim-gcp-cdn"),
  originAddress: z.string().default("sim-gcs-bucket.storage.googleapis.com"),
  cacheMode: z.enum(["CACHE_ALL_STATIC", "USE_ORIGIN_HEADERS", "FORCE_CACHE_ALL"]).default("CACHE_ALL_STATIC"),
  clientTtl: z.coerce.number().int().min(0).default(3600),
  defaultTtl: z.coerce.number().int().min(0).default(3600),
  maxTtl: z.coerce.number().int().min(0).default(86400),
  enabled: z.boolean().default(true),
  region: z.string().default("us-central1"),
});

export const GcpGkeConfigSchema = z.object({
  clusterName: z.string().default("sim-gke"),
  nodeCount: z.coerce.number().int().min(1).max(10).default(1),
  machineType: z.string().default("e2-small"),
  location: z.string().default("us-central1-a"),
  region: z.string().default("us-central1"),
});

export type GcpComputeConfig = z.infer<typeof GcpComputeConfigSchema>;
export type GcpStorageConfig = z.infer<typeof GcpStorageConfigSchema>;
export type GcpSqlConfig = z.infer<typeof GcpSqlConfigSchema>;
export type GcpFunctionConfig = z.infer<typeof GcpFunctionConfigSchema>;
export type GcpVpcConfig = z.infer<typeof GcpVpcConfigSchema>;
export type GcpArtifactRegistryConfig = z.infer<typeof GcpArtifactRegistryConfigSchema>;
export type GcpIpConfig = z.infer<typeof GcpIpPlaceholderSchema>;
export type GcpFirewallConfig = z.infer<typeof GcpFirewallConfigSchema>;
export type GcpTgConfig = z.infer<typeof GcpTgConfigSchema>;
export type GcpDiskConfig = z.infer<typeof GcpDiskConfigSchema>;
export type GcpLbConfig = z.infer<typeof GcpLbConfigSchema>;
export type GcpMigConfig = z.infer<typeof GcpMigConfigSchema>;
export type GcpCdnConfig = z.infer<typeof GcpCdnConfigSchema>;
export type GcpGkeConfig = z.infer<typeof GcpGkeConfigSchema>;

export const gcpServices: ServiceDefinition[] = [
  {
    id: "gcp_compute",
    provider: "gcp",
    label: "Compute Engine VM",
    description: "Google Cloud virtual machine instance",
    icon: "Server",
    colorKey: "gcp_compute",
    defaultConfig: GcpComputeConfigSchema.parse({}),
    schema: GcpComputeConfigSchema,
  },
  {
    id: "gcp_storage",
    provider: "gcp",
    label: "Cloud Storage Bucket",
    description: "Google Cloud object storage bucket",
    icon: "HardDrive",
    colorKey: "gcp_storage",
    defaultConfig: GcpStorageConfigSchema.parse({}),
    schema: GcpStorageConfigSchema,
  },
  {
    id: "gcp_sql",
    provider: "gcp",
    label: "Cloud SQL Database",
    description: "Managed relational database on Google Cloud",
    icon: "Database",
    colorKey: "gcp_sql",
    defaultConfig: GcpSqlConfigSchema.parse({}),
    schema: GcpSqlConfigSchema,
  },
  {
    id: "gcp_function",
    provider: "gcp",
    label: "Cloud Run Function",
    description: "Serverless function on Google Cloud",
    icon: "Zap",
    colorKey: "gcp_function",
    defaultConfig: GcpFunctionConfigSchema.parse({}),
    schema: GcpFunctionConfigSchema,
  },
  {
    id: "gcp_vpc",
    provider: "gcp",
    label: "VPC Network",
    description: "Private GCP network boundary",
    icon: "Cloud",
    colorKey: "gcp_vpc",
    defaultConfig: GcpVpcConfigSchema.parse({}),
    schema: GcpVpcConfigSchema,
  },
  {
    id: "vpc",
    provider: "gcp",
    label: "VPC / Virtual Network",
    description: "Generic cloud private network boundary",
    icon: "Cloud",
    colorKey: "vpc",
    defaultConfig: VpcConfigSchema.parse({}),
    schema: VpcConfigSchema,
  },
  {
    id: "gcp_artifact_registry",
    provider: "gcp",
    label: "Artifact Registry",
    description: "Google Cloud Artifact Registry for Docker images",
    icon: "FolderGit",
    colorKey: "gcp_artifact_registry",
    defaultConfig: GcpArtifactRegistryConfigSchema.parse({}),
    schema: GcpArtifactRegistryConfigSchema,
  },
  {
    id: "gcp_ip",
    provider: "gcp",
    label: "External Address",
    description: "Static external IP address for Google Cloud resources",
    icon: "Globe",
    colorKey: "gcp_ip",
    defaultConfig: GcpIpPlaceholderSchema.parse({}),
    schema: GcpIpPlaceholderSchema,
  },
  {
    id: "gcp_firewall",
    provider: "gcp",
    label: "Firewall Rule",
    description: "Firewall rules controlling traffic to Google VM instances",
    icon: "Shield",
    colorKey: "gcp_firewall",
    defaultConfig: GcpFirewallConfigSchema.parse({}),
    schema: GcpFirewallConfigSchema,
  },
  {
    id: "gcp_tg",
    provider: "gcp",
    label: "Backend Service",
    description: "Google Cloud Load Balancing backend service",
    icon: "Network",
    colorKey: "gcp_tg",
    defaultConfig: GcpTgConfigSchema.parse({}),
    schema: GcpTgConfigSchema,
  },
  {
    id: "gcp_disk",
    provider: "gcp",
    label: "Persistent Disk",
    description: "Google Cloud persistent block storage disk",
    icon: "HardDrive",
    colorKey: "gcp_disk",
    defaultConfig: GcpDiskConfigSchema.parse({}),
    schema: GcpDiskConfigSchema,
  },
  {
    id: "gcp_gke",
    provider: "gcp",
    label: "GKE Cluster",
    description: "Managed Kubernetes cluster on Google Cloud",
    icon: "Boxes",
    colorKey: "gcp_gke",
    defaultConfig: GcpGkeConfigSchema.parse({}),
    schema: GcpGkeConfigSchema,
  },
  {
    id: "gcp_lb",
    provider: "gcp",
    label: "Cloud Load Balancer",
    description: "Google Cloud Global HTTP Load Balancer",
    icon: "Network",
    colorKey: "gcp_lb",
    defaultConfig: GcpLbConfigSchema.parse({}),
    schema: GcpLbConfigSchema,
  },
  {
    id: "gcp_mig",
    provider: "gcp",
    label: "Managed Instance Group",
    description: "Google Cloud Managed Instance Group with autoscaler",
    icon: "Gauge",
    colorKey: "gcp_mig",
    defaultConfig: GcpMigConfigSchema.parse({}),
    schema: GcpMigConfigSchema,
  },
  {
    id: "gcp_cdn",
    provider: "gcp",
    label: "Cloud CDN",
    description: "Low-latency content delivery network utilizing global edge caches",
    icon: "Globe",
    colorKey: "gcp_cdn",
    defaultConfig: GcpCdnConfigSchema.parse({}),
    schema: GcpCdnConfigSchema,
  },
];
