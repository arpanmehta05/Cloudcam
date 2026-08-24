// AWS Multi-Service Client Factory
// Creates any AWS SDK v3 client using assumed-role credentials.

import { getCustomerCredentials } from "./credentials";

// Re-export credential types for convenience
export type { } from "./credentials";

interface ClientConfig {
    region: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
}

/**
 * Build AWS client configuration for a customer's account.
 * 
 * @param workspaceId - Rabbittize workspace ID
 * @param region - AWS region to use (default: ap-south-1)
 * @param roleArn - Customer's cross-account role ARN (optional for local dev)
 * @param externalId - ExternalId for confused deputy protection (optional for local dev)
 * @returns Configuration object suitable for any AWS SDK v3 client constructor
 * 
 * @example
 * ```typescript
 * import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
 * const config = await getClientConfig("ws-123", "ap-south-1");
 * const client = new CloudWatchClient(config);
 * ```
 */
export async function getClientConfig(
    workspaceId: string,
    region: string = "ap-south-1",
    roleArn?: string,
    externalId?: string
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

// ─────────────────────────────────────────────────────────────
// Pre-configured region constants for services with fixed regions
// ─────────────────────────────────────────────────────────────

/** Cost Explorer MUST use us-east-1 */
export const COST_EXPLORER_REGION = "us-east-1";

/** Billing metrics are only in us-east-1 */
export const BILLING_REGION = "us-east-1";

/** Health API is global, but uses us-east-1 */
export const HEALTH_REGION = "us-east-1";

/** Support API (Trusted Advisor) uses us-east-1 */
export const SUPPORT_REGION = "us-east-1";

/** Default region for most services */
export const DEFAULT_REGION = process.env.AWS_REGION || "ap-south-1";
