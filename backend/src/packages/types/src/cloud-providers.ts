export type CloudProvider = "aws" | "azure" | "gcp";

export interface CloudConnectionCredentials {
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
  billingDatasetId?: string;
  billingTableId?: string;
  [key: string]: unknown;
}
