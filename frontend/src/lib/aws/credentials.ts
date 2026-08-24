// AWS STS AssumeRole Credential Helper
// Securely assumes the customer's cross-account IAM role and caches temporary credentials.

import { STSClient, AssumeRoleCommand, Credentials } from "@aws-sdk/client-sts";

// Master account credentials — used ONLY for STS AssumeRole
const MASTER_REGION = process.env.RABBITTIZE_MASTER_REGION || "us-east-1";
const MASTER_ACCESS_KEY = process.env.RABBITTIZE_MASTER_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const MASTER_SECRET_KEY = process.env.RABBITTIZE_MASTER_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

// In-memory credential cache: workspaceId → { credentials, expiry }
interface CachedCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: Date;
}

const credentialCache = new Map<string, CachedCredentials>();

// Buffer: refresh credentials 5 minutes before they expire
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Get temporary AWS credentials for a customer's account by assuming their cross-account role.
 * 
 * @param roleArn - The ARN of the customer's cross-account role (e.g., arn:aws:iam::CUSTOMER_ID:role/RabbittizeCrossAccountRole)
 * @param externalId - The ExternalId used during CloudFormation setup for confused deputy protection
 * @param workspaceId - The Rabbittize workspace ID, used as cache key
 * @returns Temporary credentials { accessKeyId, secretAccessKey, sessionToken }
 */
export async function getCustomerCredentials(
    roleArn: string,
    externalId: string,
    workspaceId: string
): Promise<CachedCredentials> {
    // 1. Check cache
    const cached = credentialCache.get(workspaceId);
    if (cached && new Date(cached.expiration).getTime() - Date.now() > EXPIRY_BUFFER_MS) {
        return cached;
    }

    // 2. Create STS client using master account credentials
    const stsClient = new STSClient({
        region: MASTER_REGION,
        ...(MASTER_ACCESS_KEY && MASTER_SECRET_KEY
            ? {
                credentials: {
                    accessKeyId: MASTER_ACCESS_KEY,
                    secretAccessKey: MASTER_SECRET_KEY,
                },
            }
            : {}), // Falls back to default credential chain (EC2 instance role, ECS task role, etc.)
    });

    // 3. AssumeRole into customer's account
    const command = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `Rabbittize-${workspaceId}-${Date.now()}`,
        ExternalId: externalId,
        DurationSeconds: 3600, // 1 hour
    });

    const response = await stsClient.send(command);
    const creds = response.Credentials;

    if (!creds?.AccessKeyId || !creds?.SecretAccessKey || !creds?.SessionToken || !creds?.Expiration) {
        throw new Error("STS AssumeRole did not return valid credentials");
    }

    // 4. Cache and return
    const result: CachedCredentials = {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
        expiration: creds.Expiration,
    };

    credentialCache.set(workspaceId, result);

    console.log(`[AWS] Assumed role for workspace ${workspaceId}, expires at ${creds.Expiration.toISOString()}`);

    return result;
}

/**
 * Clear cached credentials for a workspace (e.g., when connection is revoked).
 */
export function clearCredentials(workspaceId: string): void {
    credentialCache.delete(workspaceId);
}

/**
 * Check if credentials are currently cached and valid for a workspace.
 */
export function hasValidCredentials(workspaceId: string): boolean {
    const cached = credentialCache.get(workspaceId);
    if (!cached) return false;
    return new Date(cached.expiration).getTime() - Date.now() > EXPIRY_BUFFER_MS;
}

// ─────────────────────────────────────────────────────────────
// TEMPORARY: For local development before webhook saves the RoleArn.
// Uses direct AWS credentials from .env instead of AssumeRole.
// ─────────────────────────────────────────────────────────────
export function getDirectCredentials(): CachedCredentials | null {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) return null;

    return {
        accessKeyId,
        secretAccessKey,
        sessionToken: "",
        expiration: new Date(Date.now() + 3600 * 1000), // Fake 1hr expiry
    };
}
