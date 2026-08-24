// AWS STS Credential Provider — AssumeRole with caching
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { config } from "../../../core/config";
import { CachedCredentials } from "../models/aws.model";

const credentialCache = new Map<string, CachedCredentials>();
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export async function getCustomerCredentials(
  roleArn: string,
  externalId: string,
  workspaceId: string,
): Promise<CachedCredentials> {
  const cached = credentialCache.get(workspaceId);
  if (
    cached &&
    new Date(cached.expiration).getTime() - Date.now() > EXPIRY_BUFFER_MS
  ) {
    return cached;
  }

  const stsClient = new STSClient({
    region: config.aws.masterRegion,
    ...(config.aws.masterAccessKeyId && config.aws.masterSecretAccessKey
      ? {
          credentials: {
            accessKeyId: config.aws.masterAccessKeyId,
            secretAccessKey: config.aws.masterSecretAccessKey,
          },
        }
      : {}),
  });

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `Rabbittize-${workspaceId}-${Date.now()}`,
    ExternalId: externalId,
    DurationSeconds: 3600,
  });

  let response;
  try {
    response = await stsClient.send(command);
  } catch (error: any) {
    const message = error?.message || "";
    const isAssumeRoleDenied =
      error?.name === "AccessDenied" ||
      message.includes("not authorized to perform: sts:AssumeRole");

    if (isAssumeRoleDenied) {
      throw new Error(
        "AWS_ASSUME_ROLE_DENIED: Failed to assume customer role. " +
          "This usually means the saved ExternalId does not match the role trust policy, " +
          "or the master IAM principal is missing sts:AssumeRole permission.",
      );
    }

    throw error;
  }

  const creds = response.Credentials;

  if (
    !creds?.AccessKeyId ||
    !creds?.SecretAccessKey ||
    !creds?.SessionToken ||
    !creds?.Expiration
  ) {
    throw new Error("STS AssumeRole did not return valid credentials");
  }

  const result: CachedCredentials = {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration,
  };

  credentialCache.set(workspaceId, result);
  console.log(
    `[AWS] Assumed role for workspace ${workspaceId}, expires at ${creds.Expiration.toISOString()}`,
  );
  return result;
}

export function clearCredentials(workspaceId: string): void {
  credentialCache.delete(workspaceId);
}

export function hasValidCredentials(workspaceId: string): boolean {
  const cached = credentialCache.get(workspaceId);
  if (!cached) return false;
  return new Date(cached.expiration).getTime() - Date.now() > EXPIRY_BUFFER_MS;
}
