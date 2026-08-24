// ─── AWS-specific Models ───

import {
  CloudProvider,
  CloudConnectionCredentials,
} from "../../../packages/types/src";

export { CloudProvider, CloudConnectionCredentials };

export interface CloudConnection {
  provider: CloudProvider;
  connectionId?: string;
  credentials: CloudConnectionCredentials;
  connectedAt?: string;
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  lastSyncStatus?: "never" | "syncing" | "ok" | "partial" | "error";
  lastError?: string;
  source?: string;
  enabledModules?: string[];
  capabilities?: string[];
  logForwardingEnabled?: boolean;
}

export interface WorkspaceCredentials {
  capabilities?: string[];
  logForwardingEnabled?: boolean;
  billingDatasetId?: string;
  billingTableId?: string;
  roleArn?: string;
  externalId?: string;
  tenantId?: string;
  subscriptionId?: string;
  billingAccountId?: string;
  clientId?: string;
  clientSecret?: string;
  principalId?: string;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  lastSyncStatus?: "never" | "syncing" | "ok" | "partial" | "error";
  lastError?: string;
  source?: string;
  [key: string]: any;
}

export interface CachedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

export interface ClientConfig {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

export interface ResourceInventory {
  ec2: any[];
  ecr?: any[];
  lambda: any[];
  rds: any[];
  s3: any[];
  ecs: any[];
  amplify: any[];
  dynamodb: any[];
  sqs: any[];
  alb: any[];
  alerts: any[];
  ebs: any[];
  eks: any[];
  autoscaling: any[];
  elasticache: any[];
  redshift: any[];
  cloudfront: any[];
  efs: any[];
  kinesis: any[];
  sns: any[];
  eventbridge: any[];
  stepfunctions: any[];
  waf: any[];
  apigateway: any[];
  [key: string]: any;
}

export interface LogQueryResult {
  timestamp: string;
  message: string;
  [key: string]: string;
}
