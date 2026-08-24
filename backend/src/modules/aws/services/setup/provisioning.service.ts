// AWS Provisioning Service — connect / test / disconnect / status
import {
    getCustomerCredentials,
    clearCredentials,
    hasValidCredentials,
} from "../../providers/sts.provider";
import {
    getCredentials,
    saveConnectionWithModules,
} from "../../../../store/workspace-credentials";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { config } from "../../../../core/config";

// TODO: Implement getWebIdentityCredentials for OIDC support
// const getWebIdentityCredentials = async () => { throw new Error("Not implemented"); };

function maskExternalId(id: string | null | undefined): string | null {
    if (!id || id.length < 6) return id ? `${id[0]}***` : null;
    return `${id.slice(0, 3)}***${id.slice(-3)}`;
}

async function validateRoleAssumption(
    userId: string,
    roleArn: string,
    externalId: string
): Promise<void> {
    const assumedCreds = await getCustomerCredentials(roleArn, externalId, userId);

    // Clear the cache after validation (will be re-populated on next use)
    clearCredentials(userId);

    // Call getCallerIdentity to verify the assumed role works
    const stsClient = new STSClient({
        region: config.aws.masterRegion,
        credentials: {
            accessKeyId: assumedCreds.accessKeyId,
            secretAccessKey: assumedCreds.secretAccessKey,
            sessionToken: assumedCreds.sessionToken,
        },
    });
    await stsClient.send(new GetCallerIdentityCommand({}));
}

export async function connectIAM(
    userId: string,
    roleArn: string,
    externalId: string,
    enabledModules?: string[],
    logForwardingEnabled?: boolean
): Promise<{ success: true; message: string; maskedExternalId: string }> {
    if (!roleArn || !externalId) {
        throw new Error("roleArn and externalId are required for IAM connection");
    }

    await validateRoleAssumption(userId, roleArn, externalId);

    await saveConnectionWithModules(
        userId,
        roleArn,
        externalId,
        enabledModules,
        logForwardingEnabled
    );

    clearCredentials(userId);

    const masked = maskExternalId(externalId);
    return {
        success: true,
        message: "AWS account connected successfully via IAM",
        maskedExternalId: masked || `${externalId[0]}***`,
    };
}

export async function connectOIDC(
    userId: string,
    roleArn: string,
    webIdentityToken: string,
    providerArn: string,
    enabledModules?: string[],
    logForwardingEnabled?: boolean
): Promise<{ success: true; message: string }> {
    throw new Error("OIDC connection is not yet implemented");
}

export async function testConnection(
    userId: string,
    webIdentityToken?: string
): Promise<{ success: true; accountId: string; arn: string; userId: string }> {
    const creds = await getCredentials(userId);
    if (!creds) {
        throw new Error("AWS_NOT_CONNECTED: No AWS connection configured");
    }

    const { roleArn, externalId } = creds;

    if (!roleArn || !externalId) {
        throw new Error("RoleArn or ExternalId is missing from stored credentials");
    }

    const assumedCreds = await getCustomerCredentials(roleArn, externalId, userId);

    const stsClient = new STSClient({
        region: config.aws.masterRegion,
        credentials: {
            accessKeyId: assumedCreds.accessKeyId,
            secretAccessKey: assumedCreds.secretAccessKey,
            sessionToken: assumedCreds.sessionToken,
        },
    });

    const result = await stsClient.send(new GetCallerIdentityCommand({}));

    return {
        success: true,
        accountId: result.Account || '',
        arn: result.Arn || '',
        userId: result.UserId || '',
    };
}

export async function disconnect(userId: string): Promise<{ success: true; message: string }> {
    clearCredentials(userId);

    try {
        const { disconnectProvider } = await import("../../../../store/workspace-credentials");
        await disconnectProvider(userId, "aws");
    } catch (err) {
        console.warn(`[disconnect] Failed to disconnect provider in store:`, err);
    }

    try {
        const { invalidateUser } = await import("../../../../core/cache/response-cache");
        invalidateUser(userId);
    } catch {
        // Response cache may not be available in all contexts
    }

    return {
        success: true,
        message: "AWS connection removed successfully",
    };
}

export async function getStatus(userId: string): Promise<{
    connected: boolean;
    roleArn?: string;
    maskedExternalId?: string | null;
    connectedAt?: string | null;
    enabledModules?: string[];
    hasValidCache?: boolean;
}> {
    const creds = await getCredentials(userId);
    if (!creds) {
        return { connected: false };
    }

    return {
        connected: true,
        roleArn: creds.roleArn,
        maskedExternalId: maskExternalId(creds.externalId),
        connectedAt: creds.connectedAt,
        enabledModules: creds.enabledModules,
        hasValidCache: hasValidCredentials(userId),
    };
}
