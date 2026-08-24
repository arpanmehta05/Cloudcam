// AWS Client Factory — builds SDK v3 client configs via STS AssumeRole
import { getCustomerCredentials } from "./sts.provider";
import { ClientConfig } from "../models/aws.model";

export async function getClientConfig(
  workspaceId: string,
  region: string = "ap-south-1",
  roleArn?: string,
  externalId?: string,
): Promise<ClientConfig> {
  if (!roleArn || !externalId) {
    throw new Error("AWS_NOT_CONNECTED");
  }
  const creds = await getCustomerCredentials(roleArn, externalId, workspaceId);
  return {
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  };
}

// Region constants
export const COST_EXPLORER_REGION = "us-east-1";
export const BILLING_REGION = "us-east-1";
export const HEALTH_REGION = "us-east-1";
export const SUPPORT_REGION = "us-east-1";
export const DEFAULT_REGION = process.env.AWS_REGION || "ap-south-1";
