import type React from "react";
import { Container, Database, FolderOpen, Inbox, Network, Server, Zap } from "@/icons";
import { getRegionSelectOptions } from "@/lib/regions";

export const ALARM_SERVICES = [
  { key: "ec2", label: "EC2 Instances", icon: "Server" },
  { key: "rds", label: "RDS Databases", icon: "Database" },
  { key: "lambda", label: "Lambda Functions", icon: "Zap" },
  { key: "ecs", label: "ECS Services", icon: "Container" },
  { key: "dynamodb", label: "DynamoDB Tables", icon: "Table" },
  { key: "sqs", label: "SQS Queues", icon: "Inbox" },
  { key: "alb", label: "Application Load Balancer", icon: "Network" },
  { key: "s3", label: "S3 Buckets", icon: "FolderOpen" },
] as const;

export const AWS_REGIONS = getRegionSelectOptions("aws");
export const AZURE_REGIONS = getRegionSelectOptions("azure");
export const GCP_REGIONS = getRegionSelectOptions("gcp");

export const COMPARISON_OPERATORS = [
  { value: "GreaterThanThreshold", label: "> Greater than" },
  { value: "GreaterThanOrEqualToThreshold", label: ">= Greater than or equal to" },
  { value: "LessThanThreshold", label: "< Less than" },
  { value: "LessThanOrEqualToThreshold", label: "<= Less than or equal to" },
];

export const STATISTICS = ["Average", "Sum", "Maximum", "Minimum", "SampleCount"];

export const SERVICE_DIMENSION_MAP: Record<string, string> = {
  ec2: "InstanceId",
  rds: "DBInstanceIdentifier",
  lambda: "FunctionName",
  ecs: "ServiceName",
  dynamodb: "TableName",
  sqs: "QueueName",
  alb: "LoadBalancer",
  s3: "BucketName",
};

export const SERVICE_NAMESPACE_MAP: Record<string, string> = {
  ec2: "AWS/EC2",
  rds: "AWS/RDS",
  lambda: "AWS/Lambda",
  ecs: "AWS/ECS",
  dynamodb: "AWS/DynamoDB",
  sqs: "AWS/SQS",
  alb: "AWS/ApplicationELB",
  s3: "AWS/S3",
};

export const SERVICE_ICON_MAP: Record<string, React.ElementType> = {
  ec2: Server,
  rds: Database,
  lambda: Zap,
  ecs: Container,
  dynamodb: Database,
  sqs: Inbox,
  alb: Network,
  s3: FolderOpen,
};
