import { z } from "zod";

export const Ec2ConfigSchema = z.object({
  instanceType: z.string().default("t3.micro"),
  count: z.coerce.number().int().min(1).max(100).default(1),
  ami: z.string().optional(),
  instanceName: z.string().default("sim-ec2"),
  region: z.string().optional(),
  keyName: z.string().optional(),
  adminUsername: z.string().default("ec2-user"),
});

export const S3ConfigSchema = z.object({
  bucketName: z.string().default("sim-s3-bucket"),
  versioning: z.boolean().default(false),
  publicAccess: z.boolean().default(false),
  policy: z.string().default(""),
  region: z.string().optional(),
});

export const RdsConfigSchema = z.object({
  engine: z.string().default("postgres"),
  instanceClass: z.string().default("db.t3.micro"),
  multiAz: z.boolean().default(false),
  storageGb: z.coerce.number().int().min(20).max(16384).default(20),
  dbName: z.string().default("simdb"),
  port: z.coerce.number().int().min(1024).max(65535).default(5432),
  region: z.string().optional(),
});

export const LambdaConfigSchema = z.object({
  runtime: z.string().default("nodejs20.x"),
  handler: z.string().default("index.handler"),
  memoryMb: z.coerce.number().int().min(128).max(10240).default(256),
  timeoutSec: z.coerce.number().int().min(1).max(900).default(30),
  functionName: z.string().default("sim-lambda"),
  code: z.string().default("exports.handler = async (event) => {\n  const response = {\n    statusCode: 200,\n    body: JSON.stringify('Hello from Lambda!'),\n  };\n  return response;\n};").optional(),
  region: z.string().optional(),
});

export const DynamoDbConfigSchema = z.object({
  tableName: z.string().default("sim-table"),
  billingMode: z.string().default("PAY_PER_REQUEST"),
  hashKey: z.string().default("id"),
  hashKeyType: z.string().default("S"),
  region: z.string().optional(),
});

export const AzureRgConfigSchema = z.object({
  name: z.string().default("custom-rg"),
  location: z.string().default("eastus"),
});

export const AzureVmConfigSchema = z.object({
  vmSize: z.string().default("Standard_B1s"),
  count: z.coerce.number().int().min(1).max(100).default(1),
  adminUsername: z.string().default("azureuser"),
  adminPassword: z.string().optional(),
  instanceName: z.string().default("sim-vm"),
  osDiskType: z.string().default("Standard_LRS"),
  imagePublisher: z.string().default("Canonical"),
  imageOffer: z.string().default("0001-com-ubuntu-server-jammy"),
  imageSku: z.string().default("22_04-lts"),
  region: z.string().optional(),
});

export const AzureStorageConfigSchema = z.object({
  bucketName: z.string().default("simstorage"),
  accountTier: z.string().default("Standard"),
  replicationType: z.string().default("LRS"),
  accountKind: z.string().default("StorageV2"),
  policy: z.string().default(""),
  region: z.string().optional(),
});

export const AzureSqlConfigSchema = z.object({
  dbName: z.string().default("simdb"),
  skuName: z.string().default("S0"),
  maxSizeBytes: z.coerce.number().default(2147483648),
  collation: z.string().default("SQL_Latin1_General_CP1_CI_AS"),
  region: z.string().optional(),
});

export const AzureFunctionConfigSchema = z.object({
  functionName: z.string().default("sim-func"),
  skuName: z.string().default("Y1"),
  region: z.string().optional(),
});

export const AzureVnetConfigSchema = z.object({
  vnetName: z.string().default("sim-vnet"),
  addressSpace: z.string().default("10.0.0.0/16"),
  subnetCidrBlock: z.string().default("10.0.1.0/24"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
  httpsPort: z.coerce.number().int().min(1).max(65535).default(443),
  isPrivate: z.boolean().default(false),
  region: z.string().optional(),
});

export const GcpComputeConfigSchema = z.object({
  instanceName: z.string().default("sim-gce"),
  machineType: z.string().default("e2-micro"),
  zone: z.string().default("us-central1-a"),
  image: z
    .string()
    .default("projects/debian-cloud/global/images/family/debian-12"),
  bootDiskGb: z.coerce.number().int().min(10).max(65536).default(20),
  allowHttp: z.boolean().default(true),
  region: z.string().optional(),
});

export const GcpStorageConfigSchema = z.object({
  bucketName: z.string().default("sim-gcs-bucket"),
  storageClass: z.string().default("STANDARD"),
  location: z.string().default("US"),
  versioning: z.boolean().default(false),
  policy: z.string().default(""),
  region: z.string().optional(),
});

export const GcpSqlConfigSchema = z.object({
  instanceName: z.string().default("sim-cloudsql"),
  databaseName: z.string().default("simdb"),
  databaseVersion: z.string().default("POSTGRES_16"),
  tier: z.string().default("db-f1-micro"),
  region: z.string().optional(),
});

export const GcpFunctionConfigSchema = z.object({
  functionName: z.string().default("sim-function"),
  runtime: z.string().default("nodejs20"),
  entryPoint: z.string().default("helloHttp"),
  region: z.string().optional(),
});

export const GcpGkeConfigSchema = z.object({
  clusterName: z.string().default("sim-gke"),
  nodeCount: z.coerce.number().int().min(1).max(10).default(1),
  machineType: z.string().default("e2-small"),
  location: z.string().default("us-central1-a"),
  region: z.string().optional(),
});

export const ApiGatewayConfigSchema = z.object({
  name: z.string().default("sim-api"),
  protocolType: z.string().default("HTTP"),
  endpointType: z.string().default("REGIONAL"),
  region: z.string().optional(),
});

export const DockerHubConfigSchema = z.object({
  repository: z.string().default("library/nginx"),
  tag: z.string().default("latest"),
  username: z.string().default("").optional(),
  password: z.string().default("").optional(),
  appPort: z.coerce.number().default(8080),
  containerPort: z.coerce.number().default(0).optional(),
});

export const GithubConfigSchema = z.object({
  gitUrl: z.string().default("https://github.com/expressjs/express.git"),
  gitBranch: z.string().default("master"),
  gitToken: z.string().optional(),
  projectType: z
    .enum(["generic_node", "node_api", "vite_spa", "mern", "nextjs", "docker"])
    .default("generic_node"),
  appRuntime: z.string().default("nodejs20"),
  buildCommand: z.string().default("npm install"),
  startCommand: z.string().default("node index.js"),
  appPort: z.coerce.number().default(3000),
  frontendDir: z.string().default("").optional(),
  backendDir: z.string().default("").optional(),
  apiPath: z.string().default("/api"),
  backendPort: z.coerce.number().default(5000),
});

export const ElbConfigSchema = z.object({
  lbName: z.string().default("sim-elb"),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("HTTP"),
  region: z.string().optional(),
});

export const AzureLbConfigSchema = z.object({
  lbName: z.string().default("sim-alb"),
  frontendPort: z.coerce.number().int().min(1).max(65535).default(80),
  backendPort: z.coerce.number().int().min(1).max(65535).default(80),
  region: z.string().optional(),
});

export const GcpLbConfigSchema = z.object({
  lbName: z.string().default("sim-glb"),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  region: z.string().optional(),
});

export const AsgConfigSchema = z.object({
  minSize: z.coerce.number().int().min(0).max(100).default(1),
  maxSize: z.coerce.number().int().min(1).max(100).default(3),
  desiredCapacity: z.coerce.number().int().min(0).max(100).default(1),
  instanceType: z.string().default("t3.micro"),
  instanceName: z.string().default("sim-asg"),
  ami: z.string().optional(),
  keyName: z.string().optional(),
  adminUsername: z.string().default("ec2-user"),
  region: z.string().optional(),
  cpuTarget: z.coerce.number().int().min(10).max(100).default(50),
});

export const AzureVmssConfigSchema = z.object({
  minSize: z.coerce.number().int().min(0).max(100).default(1),
  maxSize: z.coerce.number().int().min(1).max(100).default(3),
  desiredCapacity: z.coerce.number().int().min(0).max(100).default(1),
  adminPassword: z.string().optional(),
  vmSize: z.string().default("Standard_B1s"),
  instanceName: z.string().default("sim-vmss"),
  adminUsername: z.string().default("azureuser"),
  osDiskType: z.string().default("Standard_LRS"),
  imagePublisher: z.string().default("Canonical"),
  imageOffer: z.string().default("0001-com-ubuntu-server-jammy"),
  imageSku: z.string().default("22_04-lts"),
  region: z.string().optional(),
  cpuTarget: z.coerce.number().int().min(10).max(100).default(60),
});

export const GcpMigConfigSchema = z.object({
  minSize: z.coerce.number().int().min(0).max(100).default(1),
  maxSize: z.coerce.number().int().min(1).max(100).default(3),
  desiredCapacity: z.coerce.number().int().min(0).max(100).default(1),
  instanceName: z.string().default("sim-mig"),
  machineType: z.string().default("e2-micro"),
  zone: z.string().default("us-central1-a"),
  image: z
    .string()
    .default("projects/debian-cloud/global/images/family/debian-12"),
  bootDiskGb: z.coerce.number().int().min(10).max(65536).default(20),
  allowHttp: z.boolean().default(true),
  region: z.string().optional(),
  cpuTarget: z.coerce.number().int().min(10).max(100).default(60),
});

export const EcrConfigSchema = z.object({
  repositoryMode: z.enum(["new", "existing"]).default("new"),
  repositoryName: z.string().default("sim-repo"),
  imageMutability: z.string().default("MUTABLE"),
  scanOnPush: z.boolean().default(true),
  existingRepositoryUrl: z.string().default("").optional(),
  imageTag: z.string().default("latest").optional(),
  region: z.string().optional(),
});

export const EcsConfigSchema = z.object({
  clusterName: z.string().default("sim-cluster"),
  serviceName: z.string().default("sim-service"),
  launchType: z.enum(["FARGATE", "EC2"]).default("FARGATE"),
  useFargateSpot: z.boolean().default(false),
  fargateSpotWeight: z.coerce.number().int().min(1).max(100).default(1),
  enableServiceConnect: z.boolean().default(false),
  serviceConnectName: z.string().default("sim-app"),
  enableAutoscaling: z.boolean().default(false),
  minCapacity: z.coerce.number().int().min(1).max(10).default(1),
  maxCapacity: z.coerce.number().int().min(1).max(20).default(5),
  cpuTarget: z.coerce.number().int().min(10).max(100).default(70),
  enableSidecar: z.boolean().default(false),
  sidecarType: z.enum(["awslogs", "fluentbit", "proxy"]).default("awslogs"),
  desiredCount: z.coerce.number().int().min(1).max(10).default(1),
  cpu: z.string().default("256"),
  memory: z.string().default("512"),
  appPort: z.coerce.number().int().min(1).max(65535).default(80),
  region: z.string().optional(),
});

export const AzureAcrConfigSchema = z.object({
  repositoryMode: z.enum(["new", "existing"]).default("new"),
  registryName: z.string().default("simregistry"),
  sku: z.string().default("Basic"),
  adminEnabled: z.boolean().default(true),
  existingRepositoryUrl: z.string().default("").optional(),
  imageTag: z.string().default("latest").optional(),
  region: z.string().optional(),
});

export const GcpArtifactRegistryConfigSchema = z.object({
  repositoryMode: z.enum(["new", "existing"]).default("new"),
  repositoryId: z.string().default("sim-repo"),
  format: z.string().default("DOCKER"),
  description: z.string().default("Simulation Artifact Registry"),
  existingRepositoryUrl: z.string().default("").optional(),
  imageTag: z.string().default("latest").optional(),
  region: z.string().optional(),
});

export const EipPlaceholderSchema = z.object({
  name: z.string().default("sim-eip"),
  region: z.string().optional(),
});

export const AzurePipPlaceholderSchema = z.object({
  name: z.string().default("sim-pip"),
  region: z.string().optional(),
});

export const GcpIpPlaceholderSchema = z.object({
  name: z.string().default("sim-ip"),
  region: z.string().optional(),
});

export const SecurityRuleSchema = z.object({
  type: z.enum(["ingress", "egress"]).default("ingress"),
  fromPort: z.coerce.number().int().min(1).max(65535).default(80),
  toPort: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("tcp"),
  cidrBlocks: z.string().default("0.0.0.0/0"),
});

export const SgConfigSchema = z.object({
  name: z.string().default("sim-sg"),
  description: z.string().default("Managed security group"),
  region: z.string().optional(),
  rules: z.array(SecurityRuleSchema).default([
    { type: "ingress", fromPort: 80, toPort: 80, protocol: "tcp", cidrBlocks: "0.0.0.0/0" },
    { type: "ingress", fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: "0.0.0.0/0" }
  ]),
});

export const AzureNsgConfigSchema = z.object({
  name: z.string().default("sim-nsg"),
  description: z.string().default("Managed network security group"),
  region: z.string().optional(),
  rules: z.array(SecurityRuleSchema).default([
    { type: "ingress", fromPort: 80, toPort: 80, protocol: "tcp", cidrBlocks: "0.0.0.0/0" },
    { type: "ingress", fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: "0.0.0.0/0" }
  ]),
});

export const GcpFirewallConfigSchema = z.object({
  name: z.string().default("sim-firewall"),
  description: z.string().default("Managed firewall rules"),
  region: z.string().optional(),
  rules: z.array(SecurityRuleSchema).default([
    { type: "ingress", fromPort: 80, toPort: 80, protocol: "tcp", cidrBlocks: "0.0.0.0/0" },
    { type: "ingress", fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: "0.0.0.0/0" }
  ]),
});

export const TgConfigSchema = z.object({
  name: z.string().default("sim-tg"),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("HTTP"),
  targetType: z.string().default("instance"),
  region: z.string().optional(),
});

export const AzureTgConfigSchema = z.object({
  name: z.string().default("sim-azure-tg"),
  frontendPort: z.coerce.number().int().min(1).max(65535).default(80),
  backendPort: z.coerce.number().int().min(1).max(65535).default(80),
  region: z.string().optional(),
});

export const GcpTgConfigSchema = z.object({
  name: z.string().default("sim-gcp-tg"),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("HTTP"),
  region: z.string().optional(),
});

export const EbsConfigSchema = z.object({
  volumeName: z.string().default("sim-ebs"),
  sizeGb: z.coerce.number().int().min(1).max(16384).default(20),
  volumeType: z.string().default("gp3"),
  availabilityZone: z.string().default("us-east-1a"),
  region: z.string().optional(),
});

export const AzureDiskConfigSchema = z.object({
  diskName: z.string().default("sim-azure-disk"),
  sizeGb: z.coerce.number().int().min(1).max(32767).default(32),
  diskType: z.string().default("Standard_LRS"),
  region: z.string().optional(),
});

export const GcpDiskConfigSchema = z.object({
  diskName: z.string().default("sim-gcp-disk"),
  sizeGb: z.coerce.number().int().min(10).max(65536).default(30),
  diskType: z.string().default("pd-standard"),
  region: z.string().optional(),
});

export const AzureAksConfigSchema = z.object({
  clusterName: z.string().default("sim-aks-cluster"),
  dnsPrefix: z.string().default("simaks"),
  nodeCount: z.coerce.number().int().min(1).max(10).default(1),
  nodeVmSize: z.string().default("Standard_B2s"),
  appPort: z.coerce.number().int().min(1).max(65535).default(80),
  desiredCount: z.coerce.number().int().min(1).max(10).optional(),
  cpu: z.string().optional(),
  memory: z.string().optional(),
  region: z.string().optional(),
});

export const GcpCloudRunConfigSchema = z.object({
  serviceName: z.string().default("sim-cloud-run"),
  cpu: z.string().default("1"),
  memory: z.string().default("512Mi"),
  appPort: z.coerce.number().int().min(1).max(65535).default(80),
  desiredCount: z.coerce.number().int().min(1).max(10).default(1),
  region: z.string().optional(),
});

export const AwsVpcConfigSchema = z.object({
  vpcName: z.string().default("sim-vpc"),
  cidrBlock: z.string().default("10.0.0.0/16"),
  subnetCidrBlock: z.string().default("10.0.1.0/24"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
  httpsPort: z.coerce.number().int().min(1).max(65535).default(443),
  isPrivate: z.boolean().default(false),
  region: z.string().optional(),
});

export const GcpVpcConfigSchema = z.object({
  networkName: z.string().default("sim-vpc-network"),
  cidrBlock: z.string().default("10.0.0.0/16"),
  subnetCidrBlock: z.string().default("10.0.1.0/24"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
  httpsPort: z.coerce.number().int().min(1).max(65535).default(443),
  isPrivate: z.boolean().default(false),
  region: z.string().optional(),
});

export const VpcConfigSchema = z.object({
  vpcName: z.string().default("sim-vpc"),
  cidrBlock: z.string().default("10.0.0.0/16"),
  subnetCidrBlock: z.string().default("10.0.1.0/24"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
  httpsPort: z.coerce.number().int().min(1).max(65535).default(443),
  isPrivate: z.boolean().default(false),
  region: z.string().optional(),
});

export const AwsEksConfigSchema = z.object({
  clusterName: z.string().default("sim-eks"),
  version: z.string().default("1.35"),
  nodeCount: z.coerce.number().int().min(1).max(10).default(2),
  instanceType: z.string().default("t3.medium").optional(),
  instanceTypes: z.array(z.string()).default(["t3.medium"]),
  appPort: z.coerce.number().int().min(1).max(65535).default(80).optional(),
  region: z.string().optional(),
});

export const CloudfrontConfigSchema = z.object({
  distributionName: z.string().default("sim-cloudfront"),
  description: z.string().default("CloudFront CDN learning demo"),
  originType: z.enum(["S3", "ELB", "APIGateway", "MediaPackage", "VPCOrigin", "Other"]).default("S3"),
  originDomainName: z.string().default("sim-s3-bucket.s3.amazonaws.com"),
  originPath: z.string().default("").optional(),
  allowPrivateBucketAccess: z.boolean().default(true),
  originProtocolPolicy: z.enum(["http-only", "https-only", "match-viewer"]).default("https-only"),
  priceClass: z.enum(["PriceClass_All", "PriceClass_200", "PriceClass_100"]).default("PriceClass_All"),
  enableWaf: z.boolean().default(false),
  enabled: z.boolean().default(true),
  defaultCacheTtl: z.coerce.number().int().min(0).default(86400),
  region: z.string().optional(),
});

export const AzureCdnConfigSchema = z.object({
  profileName: z.string().default("sim-cdn-profile"),
  endpointName: z.string().default("sim-cdn-endpoint"),
  skuName: z.enum(["Standard_Akamai", "Standard_Verizon", "Premium_Verizon", "Standard_Microsoft", "Standard_AzureFrontDoor", "Premium_AzureFrontDoor"]).default("Standard_Microsoft"),
  originHostName: z.string().default("simstorage.blob.core.windows.net"),
  enabled: z.boolean().default(true),
  region: z.string().optional(),
});

export const GcpCdnConfigSchema = z.object({
  cdnName: z.string().default("sim-gcp-cdn"),
  originAddress: z.string().default("sim-gcs-bucket.storage.googleapis.com"),
  cacheMode: z.enum(["CACHE_ALL_STATIC", "USE_ORIGIN_HEADERS", "FORCE_CACHE_ALL"]).default("CACHE_ALL_STATIC"),
  clientTtl: z.coerce.number().int().min(0).default(3600),
  defaultTtl: z.coerce.number().int().min(0).default(3600),
  maxTtl: z.coerce.number().int().min(0).default(86400),
  enabled: z.boolean().default(true),
  region: z.string().optional(),
});

export const ServiceSchemas: Record<string, z.ZodObject<any>> = {
  github: GithubConfigSchema,
  apigateway: ApiGatewayConfigSchema,
  dockerhub: DockerHubConfigSchema,
  ecr: EcrConfigSchema,
  azure_acr: AzureAcrConfigSchema,
  gcp_artifact_registry: GcpArtifactRegistryConfigSchema,
  eip: EipPlaceholderSchema,
  azure_pip: AzurePipPlaceholderSchema,
  gcp_ip: GcpIpPlaceholderSchema,
  sg: SgConfigSchema,
  azure_nsg: AzureNsgConfigSchema,
  gcp_firewall: GcpFirewallConfigSchema,
  tg: TgConfigSchema,
  azure_tg: AzureTgConfigSchema,
  gcp_tg: GcpTgConfigSchema,
  ebs: EbsConfigSchema,
  azure_disk: AzureDiskConfigSchema,
  gcp_disk: GcpDiskConfigSchema,
  ec2: Ec2ConfigSchema,
  s3: S3ConfigSchema,
  rds: RdsConfigSchema,
  lambda: LambdaConfigSchema,
  dynamodb: DynamoDbConfigSchema,
  azure_vm: AzureVmConfigSchema,
  azure_storage: AzureStorageConfigSchema,
  azure_sql: AzureSqlConfigSchema,
  azure_function: AzureFunctionConfigSchema,
  azure_vnet: AzureVnetConfigSchema,
  azure_aks: AzureAksConfigSchema,
  aws_vpc: AwsVpcConfigSchema,
  gcp_compute: GcpComputeConfigSchema,
  gcp_storage: GcpStorageConfigSchema,
  gcp_sql: GcpSqlConfigSchema,
  gcp_function: GcpFunctionConfigSchema,
  gcp_gke: GcpGkeConfigSchema,
  gcp_cloud_run: GcpCloudRunConfigSchema,
  gcp_vpc: GcpVpcConfigSchema,
  vpc: VpcConfigSchema,
  elb: ElbConfigSchema,
  azure_lb: AzureLbConfigSchema,
  gcp_lb: GcpLbConfigSchema,
  asg: AsgConfigSchema,
  azure_vmss: AzureVmssConfigSchema,
  gcp_mig: GcpMigConfigSchema,
  ecs: EcsConfigSchema,
  eks: AwsEksConfigSchema,
  cloudfront: CloudfrontConfigSchema,
  azure_cdn: AzureCdnConfigSchema,
  gcp_cdn: GcpCdnConfigSchema,
  azure_rg: AzureRgConfigSchema,
};;;
