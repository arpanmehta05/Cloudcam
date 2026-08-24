import { z } from "zod";
import { ServiceDefinition } from "./common.registry";
import { VpcConfigSchema } from "./aws.registry";

export const AzureAksConfigSchema = z.object({
  clusterName: z.string().default("sim-aks"),
  nodeCount: z.coerce.number().int().min(1).max(100).default(1),
  nodeVmSize: z.string().default("Standard_B2s"),
  dnsPrefix: z.string().default("simaks"),
  region: z.string().default("eastus"),
});

export const AzureVmConfigSchema = z.object({
  vmSize: z.string().default("Standard_B1s"),
  count: z.coerce.number().int().min(1).max(100).default(1),
  adminUsername: z.string().default("azureuser"),
  instanceName: z.string().default("sim-vm"),
  osDiskType: z.string().default("Standard_LRS"),
  imagePublisher: z.string().default("Canonical"),
  imageOffer: z.string().default("0001-com-ubuntu-server-jammy"),
  imageSku: z.string().default("22_04-lts"),
  region: z.string().default("centralindia"),
});

export const AzureStorageConfigSchema = z.object({
  bucketName: z.string().default("simstorage"),
  accountTier: z.string().default("Standard"),
  replicationType: z.string().default("LRS"),
  accountKind: z.string().default("StorageV2"),
  region: z.string().default("centralindia"),
  policy: z.string().default(""),
});

export const AzureSqlConfigSchema = z.object({
  dbName: z.string().default("simdb"),
  skuName: z.string().default("S0"),
  maxSizeBytes: z.coerce.number().default(2147483648),
  collation: z.string().default("SQL_Latin1_General_CP1_CI_AS"),
  region: z.string().default("centralindia"),
});

export const AzureFunctionConfigSchema = z.object({
  functionName: z.string().default("sim-func"),
  skuName: z.string().default("Y1"),
  region: z.string().default("centralindia"),
});

export const AzureVnetConfigSchema = z.object({
  vnetName: z.string().default("sim-vnet"),
  addressSpace: z.string().default("10.0.0.0/16"),
  subnetCidrBlock: z.string().default("10.0.1.0/24"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
  httpsPort: z.coerce.number().int().min(1).max(65535).default(443),
  isPrivate: z.boolean().default(false),
  region: z.string().default("centralindia"),
});

export const AzureAcrConfigSchema = z.object({
  repositoryMode: z.enum(["new", "existing"]).default("new"),
  registryName: z.string().default("simregistry"),
  sku: z.string().default("Basic"),
  adminEnabled: z.boolean().default(true),
  existingRepositoryUrl: z.string().default("").optional(),
  imageTag: z.string().default("latest").optional(),
  region: z.string().default("centralindia"),
});

export const AzurePipPlaceholderSchema = z.object({
  name: z.string().default("sim-pip"),
  region: z.string().default("centralindia"),
});

const SecurityRuleSchema = z.object({
  type: z.enum(["ingress", "egress"]).default("ingress"),
  fromPort: z.coerce.number().int().min(1).max(65535).default(80),
  toPort: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("tcp"),
  cidrBlocks: z.string().default("0.0.0.0/0"),
});

export const AzureNsgConfigSchema = z.object({
  name: z.string().default("sim-nsg"),
  description: z.string().default("Managed network security group"),
  region: z.string().default("centralindia"),
  rules: z.array(SecurityRuleSchema).default([
    { type: "ingress", fromPort: 80, toPort: 80, protocol: "tcp", cidrBlocks: "0.0.0.0/0" },
    { type: "ingress", fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: "0.0.0.0/0" }
  ]),
});

export const AzureTgConfigSchema = z.object({
  name: z.string().default("sim-azure-tg"),
  frontendPort: z.coerce.number().int().min(1).max(65535).default(80),
  backendPort: z.coerce.number().int().min(1).max(65535).default(80),
  region: z.string().default("centralindia"),
});

export const AzureDiskConfigSchema = z.object({
  diskName: z.string().default("sim-azure-disk"),
  sizeGb: z.coerce.number().int().min(1).max(32767).default(32),
  diskType: z.string().default("Standard_LRS"),
  region: z.string().default("centralindia"),
});

export const AzureLbConfigSchema = z.object({
  lbName: z.string().default("sim-alb"),
  frontendPort: z.coerce.number().int().min(1).max(65535).default(80),
  backendPort: z.coerce.number().int().min(1).max(65535).default(80),
  region: z.string().default("centralindia"),
});

export const AzureVmssConfigSchema = z.object({
  minSize: z.coerce.number().int().min(0).max(100).default(1),
  maxSize: z.coerce.number().int().min(1).max(100).default(3),
  desiredCapacity: z.coerce.number().int().min(0).max(100).default(1),
  vmSize: z.string().default("Standard_B1s"),
  adminUsername: z.string().default("azureuser"),
  instanceName: z.string().default("sim-vmss"),
  osDiskType: z.string().default("Standard_LRS"),
  imagePublisher: z.string().default("Canonical"),
  imageOffer: z.string().default("0001-com-ubuntu-server-jammy"),
  imageSku: z.string().default("22_04-lts"),
  region: z.string().default("centralindia"),
  cpuTarget: z.coerce.number().int().min(10).max(100).default(60),
});

export const AzureCdnConfigSchema = z.object({
  profileName: z.string().default("sim-cdn-profile"),
  endpointName: z.string().default("sim-cdn-endpoint"),
  skuName: z.enum(["Standard_Akamai", "Standard_Verizon", "Premium_Verizon", "Standard_Microsoft", "Standard_AzureFrontDoor", "Premium_AzureFrontDoor"]).default("Standard_Microsoft"),
  originHostName: z.string().default("simstorage.blob.core.windows.net"),
  enabled: z.boolean().default(true),
  region: z.string().default("centralindia"),
});

export type AzureAksConfig = z.infer<typeof AzureAksConfigSchema>;
export type AzureVmConfig = z.infer<typeof AzureVmConfigSchema>;
export type AzureStorageConfig = z.infer<typeof AzureStorageConfigSchema>;
export type AzureSqlConfig = z.infer<typeof AzureSqlConfigSchema>;
export type AzureFunctionConfig = z.infer<typeof AzureFunctionConfigSchema>;
export type AzureVnetConfig = z.infer<typeof AzureVnetConfigSchema>;
export type AzureAcrConfig = z.infer<typeof AzureAcrConfigSchema>;
export type AzurePipConfig = z.infer<typeof AzurePipPlaceholderSchema>;
export type AzureNsgConfig = z.infer<typeof AzureNsgConfigSchema>;
export type AzureTgConfig = z.infer<typeof AzureTgConfigSchema>;
export type AzureDiskConfig = z.infer<typeof AzureDiskConfigSchema>;
export type AzureLbConfig = z.infer<typeof AzureLbConfigSchema>;
export type AzureVmssConfig = z.infer<typeof AzureVmssConfigSchema>;
export type AzureCdnConfig = z.infer<typeof AzureCdnConfigSchema>;

export const azureServices: ServiceDefinition[] = [
  {
    id: "azure_vm",
    provider: "azure",
    label: "Virtual Machine",
    description: "Azure Linux virtual machine",
    icon: "Server",
    colorKey: "azure_vm",
    defaultConfig: AzureVmConfigSchema.parse({}),
    schema: AzureVmConfigSchema,
  },
  {
    id: "azure_storage",
    provider: "azure",
    label: "Storage Account",
    description: "Azure object and blob storage account",
    icon: "HardDrive",
    colorKey: "azure_storage",
    defaultConfig: AzureStorageConfigSchema.parse({}),
    schema: AzureStorageConfigSchema,
  },
  {
    id: "azure_sql",
    provider: "azure",
    label: "Azure SQL Database",
    description: "Managed SQL database on Azure",
    icon: "Database",
    colorKey: "azure_sql",
    defaultConfig: AzureSqlConfigSchema.parse({}),
    schema: AzureSqlConfigSchema,
  },
  {
    id: "azure_function",
    provider: "azure",
    label: "Function App",
    description: "Serverless function app on Azure",
    icon: "Zap",
    colorKey: "azure_function",
    defaultConfig: AzureFunctionConfigSchema.parse({}),
    schema: AzureFunctionConfigSchema,
  },
  {
    id: "azure_vnet",
    provider: "azure",
    label: "Virtual Network",
    description: "Private Azure network boundary",
    icon: "Cloud",
    colorKey: "azure_vnet",
    defaultConfig: AzureVnetConfigSchema.parse({}),
    schema: AzureVnetConfigSchema,
  },
  {
    id: "vpc",
    provider: "azure",
    label: "VPC / Virtual Network",
    description: "Generic cloud private network boundary",
    icon: "Cloud",
    colorKey: "vpc",
    defaultConfig: VpcConfigSchema.parse({}),
    schema: VpcConfigSchema,
  },
  {
    id: "azure_acr",
    provider: "azure",
    label: "Container Registry",
    description: "Azure Container Registry (ACR) for Docker images",
    icon: "FolderGit",
    colorKey: "azure_acr",
    defaultConfig: AzureAcrConfigSchema.parse({}),
    schema: AzureAcrConfigSchema,
  },
  {
    id: "azure_pip",
    provider: "azure",
    label: "Public IP",
    description: "Static public IP address for Azure resources",
    icon: "Globe",
    colorKey: "azure_pip",
    defaultConfig: AzurePipPlaceholderSchema.parse({}),
    schema: AzurePipPlaceholderSchema,
  },
  {
    id: "azure_nsg",
    provider: "azure",
    label: "Network Security Group",
    description: "Security rules controlling traffic in a virtual network",
    icon: "Shield",
    colorKey: "azure_nsg",
    defaultConfig: AzureNsgConfigSchema.parse({}),
    schema: AzureNsgConfigSchema,
  },
  {
    id: "azure_tg",
    provider: "azure",
    label: "Backend Address Pool",
    description: "Azure Load Balancer Backend Address Pool",
    icon: "Network",
    colorKey: "azure_tg",
    defaultConfig: AzureTgConfigSchema.parse({}),
    schema: AzureTgConfigSchema,
  },
  {
    id: "azure_disk",
    provider: "azure",
    label: "Managed Disk",
    description: "Azure Managed Disk for persistent VM storage",
    icon: "HardDrive",
    colorKey: "azure_disk",
    defaultConfig: AzureDiskConfigSchema.parse({}),
    schema: AzureDiskConfigSchema,
  },
  {
    id: "azure_aks",
    provider: "azure",
    label: "AKS Cluster",
    description: "Managed Kubernetes service on Azure",
    icon: "Boxes",
    colorKey: "azure_aks",
    defaultConfig: AzureAksConfigSchema.parse({}),
    schema: AzureAksConfigSchema,
  },
  {
    id: "azure_lb",
    provider: "azure",
    label: "Load Balancer",
    description: "Azure Public Load Balancer for VM traffic distribution",
    icon: "Network",
    colorKey: "azure_lb",
    defaultConfig: AzureLbConfigSchema.parse({}),
    schema: AzureLbConfigSchema,
  },
  {
    id: "azure_vmss",
    provider: "azure",
    label: "VM Scale Set",
    description: "Azure Virtual Machine Scale Set for horizontal autoscaling",
    icon: "Gauge",
    colorKey: "azure_vmss",
    defaultConfig: AzureVmssConfigSchema.parse({}),
    schema: AzureVmssConfigSchema,
  },
  {
    id: "azure_cdn",
    provider: "azure",
    label: "CDN / Front Door",
    description: "Global content delivery network and security service",
    icon: "Globe",
    colorKey: "azure_cdn",
    defaultConfig: AzureCdnConfigSchema.parse({}),
    schema: AzureCdnConfigSchema,
  },
];
