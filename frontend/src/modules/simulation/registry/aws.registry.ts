import { z } from "zod";
import { ServiceDefinition } from "./common.registry";

export const Ec2ConfigSchema = z.object({
  instanceType: z.string().default("t3.micro"),
  count: z.coerce.number().int().min(1).max(100).default(1),
  region: z.string().default("us-east-1"),
  ami: z.string().default(""),
  keyName: z.string().default("sim-key"),
  instanceName: z.string().default("sim-ec2"),
  adminUsername: z.string().default("ec2-user"),
  vpcId: z.string().default("").optional(),
  subnetId: z.string().default("").optional(),
  securityGroup: z.string().default("").optional(),
});

export const S3ConfigSchema = z.object({
  bucketName: z.string().default("sim-s3-bucket"),
  region: z.string().default("us-east-1"),
  versioning: z.boolean().default(false),
  publicAccess: z.boolean().default(false),
  lifecycleRule: z.string().default("none"),
  policy: z.string().default(""),
});

export const RdsConfigSchema = z.object({
  engine: z.string().default("postgres"),
  engineVersion: z.string().default("16"),
  instanceClass: z.string().default("db.t3.micro"),
  multiAz: z.boolean().default(false),
  storageGb: z.coerce.number().int().min(20).max(16384).default(50),
  storageType: z.string().default("gp3"),
  dbName: z.string().default("simdb"),
  dbUsername: z.string().default("admin"),
  port: z.coerce.number().int().min(1024).max(65535).default(5432),
  publiclyAccessible: z.boolean().default(false),
});

export const LambdaConfigSchema = z.object({
  runtime: z.string().default("nodejs20.x"),
  handler: z.string().default("index.handler"),
  memoryMb: z.coerce.number().int().min(128).max(10240).default(256),
  timeoutSec: z.coerce.number().int().min(1).max(900).default(30),
  functionName: z.string().default("sim-lambda"),
  environment: z.string().default("dev"),
  code: z.string().default("exports.handler = async (event) => {\n  const response = {\n    statusCode: 200,\n    body: JSON.stringify('Hello from Lambda!'),\n  };\n  return response;\n};").optional(),
});

export const DynamoDbConfigSchema = z.object({
  tableName: z.string().default("sim-table"),
  billingMode: z.string().default("PAY_PER_REQUEST"),
  hashKey: z.string().default("id"),
  hashKeyType: z.string().default("S"),
  region: z.string().default("us-east-1"),
});

export const ApiGatewayConfigSchema = z.object({
  name: z.string().default("sim-api"),
  protocolType: z.string().default("HTTP"),
  endpointType: z.string().default("REGIONAL"),
  region: z.string().default("us-east-1"),
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
  region: z.string().default("us-east-1"),
});

export const EksConfigSchema = z.object({
  clusterName: z.string().default("sim-eks"),
  version: z.string().default("1.35"),
  nodeCount: z.coerce.number().int().min(1).max(10).default(2),
  instanceType: z.string().default("t3.medium"),
  appPort: z.coerce.number().int().min(1).max(65535).default(80),
  region: z.string().default("us-east-1"),
});

export const AwsVpcConfigSchema = z.object({
  vpcName: z.string().default("sim-vpc"),
  cidrBlock: z.string().default("10.0.0.0/16"),
  subnetCidrBlock: z.string().default("10.0.1.0/24"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
  httpsPort: z.coerce.number().int().min(1).max(65535).default(443),
  isPrivate: z.boolean().default(false),
  region: z.string().default("us-east-1"),
});

export const VpcConfigSchema = z.object({
  vpcName: z.string().default("sim-vpc"),
  cidrBlock: z.string().default("10.0.0.0/16"),
  subnetCidrBlock: z.string().default("10.0.1.0/24"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
  httpsPort: z.coerce.number().int().min(1).max(65535).default(443),
  isPrivate: z.boolean().default(false),
  region: z.string().default("us-east-1"),
});

export const EcrConfigSchema = z.object({
  repositoryMode: z.enum(["new", "existing"]).default("new"),
  repositoryName: z.string().default("sim-repo"),
  imageMutability: z.string().default("MUTABLE"),
  scanOnPush: z.boolean().default(true),
  existingRepositoryUrl: z.string().default("").optional(),
  imageTag: z.string().default("latest").optional(),
  region: z.string().default("us-east-1"),
});

export const EipPlaceholderSchema = z.object({
  name: z.string().default("sim-eip"),
  region: z.string().default("us-east-1"),
});

const SecurityRuleSchema = z.object({
  type: z.enum(["ingress", "egress"]).default("ingress"),
  fromPort: z.coerce.number().int().min(1).max(65535).default(80),
  toPort: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("tcp"),
  cidrBlocks: z.string().default("0.0.0.0/0"),
});

export const SgConfigSchema = z.object({
  name: z.string().default("sim-sg"),
  description: z.string().default("Managed security group"),
  region: z.string().default("us-east-1"),
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
  region: z.string().default("us-east-1"),
});

export const EbsConfigSchema = z.object({
  volumeName: z.string().default("sim-ebs"),
  sizeGb: z.coerce.number().int().min(1).max(16384).default(20),
  volumeType: z.string().default("gp3"),
  availabilityZone: z.string().default("us-east-1a"),
  region: z.string().default("us-east-1"),
});

export const ElbConfigSchema = z.object({
  lbName: z.string().default("sim-elb"),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  protocol: z.string().default("HTTP"),
  region: z.string().default("us-east-1"),
});

export const AsgConfigSchema = z.object({
  minSize: z.coerce.number().int().min(0).max(100).default(1),
  maxSize: z.coerce.number().int().min(1).max(100).default(3),
  desiredCapacity: z.coerce.number().int().min(0).max(100).default(1),
  instanceType: z.string().default("t3.micro"),
  region: z.string().default("us-east-1"),
  ami: z.string().default(""),
  keyName: z.string().default("sim-key"),
  instanceName: z.string().default("sim-asg"),
  adminUsername: z.string().default("ec2-user"),
  cpuTarget: z.coerce.number().int().min(10).max(100).default(50),
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
  region: z.string().default("us-east-1"),
});

export type Ec2Config = z.infer<typeof Ec2ConfigSchema>;
export type S3Config = z.infer<typeof S3ConfigSchema>;
export type RdsConfig = z.infer<typeof RdsConfigSchema>;
export type LambdaConfig = z.infer<typeof LambdaConfigSchema>;
export type DynamoDbConfig = z.infer<typeof DynamoDbConfigSchema>;
export type ApiGatewayConfig = z.infer<typeof ApiGatewayConfigSchema>;
export type EcsConfig = z.infer<typeof EcsConfigSchema>;
export type EksConfig = z.infer<typeof EksConfigSchema>;
export type AwsVpcConfig = z.infer<typeof AwsVpcConfigSchema>;
export type VpcConfig = z.infer<typeof VpcConfigSchema>;
export type EcrConfig = z.infer<typeof EcrConfigSchema>;
export type EipConfig = z.infer<typeof EipPlaceholderSchema>;
export type SgConfig = z.infer<typeof SgConfigSchema>;
export type TgConfig = z.infer<typeof TgConfigSchema>;
export type EbsConfig = z.infer<typeof EbsConfigSchema>;
export type ElbConfig = z.infer<typeof ElbConfigSchema>;
export type AsgConfig = z.infer<typeof AsgConfigSchema>;
export type CloudfrontConfig = z.infer<typeof CloudfrontConfigSchema>;

export const awsServices: ServiceDefinition[] = [
  {
    id: "ec2",
    provider: "aws",
    label: "EC2 Instance",
    description: "Elastic Compute Cloud virtual server",
    icon: "Server",
    colorKey: "ec2",
    defaultConfig: Ec2ConfigSchema.parse({}),
    schema: Ec2ConfigSchema,
  },
  {
    id: "s3",
    provider: "aws",
    label: "S3 Bucket",
    description: "Object storage for data and artifacts",
    icon: "HardDrive",
    colorKey: "s3",
    defaultConfig: S3ConfigSchema.parse({}),
    schema: S3ConfigSchema,
  },
  {
    id: "rds",
    provider: "aws",
    label: "RDS Database",
    description: "Managed relational database service",
    icon: "Database",
    colorKey: "rds",
    defaultConfig: RdsConfigSchema.parse({}),
    schema: RdsConfigSchema,
  },
  {
    id: "lambda",
    provider: "aws",
    label: "Lambda Function",
    description: "Serverless compute function",
    icon: "Zap",
    colorKey: "lambda",
    defaultConfig: LambdaConfigSchema.parse({}),
    schema: LambdaConfigSchema,
  },
  {
    id: "dynamodb",
    provider: "aws",
    label: "DynamoDB Table",
    description: "Fast and flexible NoSQL database service",
    icon: "Database",
    colorKey: "dynamodb",
    defaultConfig: DynamoDbConfigSchema.parse({}),
    schema: DynamoDbConfigSchema,
  },
  {
    id: "apigateway",
    provider: "aws",
    label: "API Gateway",
    description: "Fully managed API management service",
    icon: "Cloud",
    colorKey: "apigateway",
    defaultConfig: ApiGatewayConfigSchema.parse({}),
    schema: ApiGatewayConfigSchema,
  },
  {
    id: "ecs",
    provider: "aws",
    label: "ECS Cluster",
    description: "Highly secure, reliable, and scalable container execution",
    icon: "Container",
    colorKey: "ecs",
    defaultConfig: EcsConfigSchema.parse({}),
    schema: EcsConfigSchema,
  },
  {
    id: "eks",
    provider: "aws",
    label: "EKS Cluster",
    description: "Managed Kubernetes service",
    icon: "Boxes",
    colorKey: "eks",
    defaultConfig: EksConfigSchema.parse({}),
    schema: EksConfigSchema,
  },
  {
    id: "ecr",
    provider: "aws",
    label: "ECR Registry",
    description: "Elastic Container Registry for Docker images",
    icon: "FolderGit",
    colorKey: "ecr",
    defaultConfig: EcrConfigSchema.parse({}),
    schema: EcrConfigSchema,
  },
  {
    id: "eip",
    provider: "aws",
    label: "Elastic IP",
    description: "Static public IPv4 address for EC2 instances",
    icon: "Globe",
    colorKey: "eip",
    defaultConfig: EipPlaceholderSchema.parse({}),
    schema: EipPlaceholderSchema,
  },
  {
    id: "sg",
    provider: "aws",
    label: "Security Group",
    description: "Virtual firewall controlling traffic to AWS resources",
    icon: "Shield",
    colorKey: "sg",
    defaultConfig: SgConfigSchema.parse({}),
    schema: SgConfigSchema,
  },
  {
    id: "tg",
    provider: "aws",
    label: "Target Group",
    description: "AWS ALB Target Group for routing request traffic",
    icon: "Network",
    colorKey: "tg",
    defaultConfig: TgConfigSchema.parse({}),
    schema: TgConfigSchema,
  },
  {
    id: "ebs",
    provider: "aws",
    label: "EBS Volume",
    description: "Elastic Block Store persistent storage volume",
    icon: "HardDrive",
    colorKey: "ebs",
    defaultConfig: EbsConfigSchema.parse({}),
    schema: EbsConfigSchema,
  },
  {
    id: "aws_vpc",
    provider: "aws",
    label: "Virtual Private Cloud (VPC)",
    description: "Private AWS network boundary",
    icon: "Cloud",
    colorKey: "aws_vpc",
    defaultConfig: AwsVpcConfigSchema.parse({}),
    schema: AwsVpcConfigSchema,
  },
  {
    id: "vpc",
    provider: "aws",
    label: "VPC / Virtual Network",
    description: "Generic cloud private network boundary",
    icon: "Cloud",
    colorKey: "vpc",
    defaultConfig: VpcConfigSchema.parse({}),
    schema: VpcConfigSchema,
  },
  {
    id: "elb",
    provider: "aws",
    label: "Elastic Load Balancer",
    description: "Distributes incoming application traffic across EC2 instances",
    icon: "Network",
    colorKey: "elb",
    defaultConfig: ElbConfigSchema.parse({}),
    schema: ElbConfigSchema,
  },
  {
    id: "asg",
    provider: "aws",
    label: "Auto Scaling Group",
    description: "Automatically scales EC2 capacity up or down based on criteria",
    icon: "Gauge",
    colorKey: "asg",
    defaultConfig: AsgConfigSchema.parse({}),
    schema: AsgConfigSchema,
  },
  {
    id: "cloudfront",
    provider: "aws",
    label: "CloudFront Distribution",
    description: "Global content delivery network (CDN) service",
    icon: "Globe",
    colorKey: "cloudfront",
    defaultConfig: CloudfrontConfigSchema.parse({}),
    schema: CloudfrontConfigSchema,
  },
];
