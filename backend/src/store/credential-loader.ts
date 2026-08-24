import mongoose from "mongoose";
import { User } from "../models/user.model";
import { CloudProvider, WorkspaceCredentials } from "../models/aws.model";

export const DEFAULT_MODULES = ["core-monitoring", "cost", "security"];

export async function resolveTargetUserId(userId: string): Promise<string> {
    const user = await User.findById(userId).select("tenantId");
    if (user && user.tenantId && user.tenantId !== userId) {
        return user.tenantId;
    }
    return userId;
}

export function credentialFields(credentials: WorkspaceCredentials | null): Record<string, unknown> {
    if (!credentials) return {};
    return {
        roleArn: credentials.roleArn,
        externalId: credentials.externalId,
        tenantId: credentials.tenantId,
        subscriptionId: credentials.subscriptionId,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        principalId: credentials.principalId,
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey,
        billingDatasetId: credentials.billingDatasetId,
        billingTableId: credentials.billingTableId,
    };
}

export async function getCredentials(userId: string, provider: CloudProvider = "aws"): Promise<WorkspaceCredentials | null> {
    const targetUserId = await resolveTargetUserId(userId);
    const user = await User.findById(targetUserId).select("awsCredentials azureCredentials gcpCredentials cloudConnections");
    if (!user) return null;

    const connection = user.cloudConnections?.find(item => item.provider === provider);
    if (connection?.credentials) {
        return {
            provider,
            connectionId: connection.connectionId,
            roleArn: connection.credentials.roleArn,
            externalId: connection.credentials.externalId,
            tenantId: connection.credentials.tenantId,
            subscriptionId: connection.credentials.subscriptionId,
            clientId: connection.credentials.clientId,
            clientSecret: connection.credentials.clientSecret,
            principalId: connection.credentials.principalId,
            projectId: connection.credentials.projectId,
            clientEmail: connection.credentials.clientEmail,
            privateKey: typeof connection.credentials.privateKey === "string" ? connection.credentials.privateKey.replace(/\\n/g, "\n") : connection.credentials.privateKey,
            billingDatasetId: connection.credentials.billingDatasetId,
            billingTableId: connection.credentials.billingTableId,
            connectedAt: connection.connectedAt?.toISOString(),
            enabledModules: connection.enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: connection.logForwardingEnabled || false,
        };
    }

    if (provider === "azure" && user.azureCredentials?.tenantId) {
        return {
            provider: "azure",
            tenantId: user.azureCredentials.tenantId,
            subscriptionId: user.azureCredentials.subscriptionId,
            billingAccountId: user.azureCredentials.billingAccountId,
            clientId: user.azureCredentials.clientId,
            clientSecret: user.azureCredentials.clientSecret,
            principalId: user.azureCredentials.principalId,
            connectedAt: user.azureCredentials.connectedAt?.toISOString(),
            enabledModules: user.azureCredentials.enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: user.azureCredentials.logForwardingEnabled || false,
        };
    }

    if (provider === "gcp" && user.gcpCredentials?.projectId) {
        return {
            provider: "gcp",
            projectId: user.gcpCredentials.projectId,
            clientEmail: user.gcpCredentials.clientEmail,
            privateKey: user.gcpCredentials.privateKey,
            billingDatasetId: user.gcpCredentials.billingDatasetId,
            billingTableId: user.gcpCredentials.billingTableId,
            connectedAt: user.gcpCredentials.connectedAt?.toISOString(),
            enabledModules: user.gcpCredentials.enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: user.gcpCredentials.logForwardingEnabled || false,
        };
    }

    if (provider === "aws" && user.awsCredentials?.roleArn) {
        return {
            provider: "aws",
            roleArn: user.awsCredentials.roleArn,
            externalId: user.awsCredentials.externalId,
            connectedAt: user.awsCredentials.connectedAt?.toISOString(),
            enabledModules: user.awsCredentials.enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: user.awsCredentials.logForwardingEnabled || false,
        };
    }

    return null;
}

export async function isConnected(userId: string, provider: CloudProvider = "aws"): Promise<boolean> {
    const creds = await getCredentials(userId, provider);
    if (provider === "azure") {
        return !!(creds?.tenantId && creds?.subscriptionId && ((creds?.clientId && creds?.clientSecret) || creds?.principalId));
    }
    if (provider === "gcp") {
        return !!(creds?.projectId && creds?.clientEmail);
    }
    return !!creds?.roleArn;
}

export async function isModuleEnabled(userId: string, module: string, provider: CloudProvider = "aws"): Promise<boolean> {
    const creds = await getCredentials(userId, provider);
    if (!creds) return false;
    return (creds.enabledModules || DEFAULT_MODULES).includes(module);
}
