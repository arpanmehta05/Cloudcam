import mongoose from "mongoose";
import { User } from "../models/user.model";
import { CloudProvider, WorkspaceCredentials } from "../models/aws.model";
import { clearCredentials as clearAwsCredentialsCache } from "../providers/aws/sts.provider";
import {
    resolveTargetUserId,
    credentialFields,
    getCredentials,
    isConnected,
    isModuleEnabled,
    DEFAULT_MODULES
} from "./credential-loader";

export {
    resolveTargetUserId,
    getCredentials,
    isConnected,
    isModuleEnabled
};

interface StoredConnection {
    provider: CloudProvider;
    connectionId: string;
    credentials: Record<string, unknown>;
    connectedAt?: Date;
    enabledModules: string[];
    logForwardingEnabled: boolean;
}

function buildConnection(
    provider: CloudProvider,
    credentials: Record<string, unknown>,
    extra: Record<string, unknown> = {}
): StoredConnection {
    return {
        provider,
        connectionId: provider,
        credentials,
        enabledModules: DEFAULT_MODULES,
        logForwardingEnabled: false,
        ...extra,
    };
}

async function upsertCloudConnection(
    userId: string,
    provider: CloudProvider,
    connection: ReturnType<typeof buildConnection>
): Promise<void> {
    const updated = await User.findOneAndUpdate(
        { _id: userId, "cloudConnections.provider": provider },
        {
            $set: {
                "cloudConnections.$.connectionId": connection.connectionId,
                "cloudConnections.$.credentials": connection.credentials,
                "cloudConnections.$.connectedAt": connection.connectedAt,
                "cloudConnections.$.enabledModules": connection.enabledModules,
                "cloudConnections.$.logForwardingEnabled": connection.logForwardingEnabled,
            },
        }
    );

    if (!updated) {
        await User.findByIdAndUpdate(userId, {
            $push: { cloudConnections: connection },
        });
    }
}

export async function saveExternalId(userId: string, externalId: string, provider: CloudProvider = "aws"): Promise<void> {
    const targetUserId = await resolveTargetUserId(userId);
    if (provider === "aws") {
        await User.findByIdAndUpdate(targetUserId, {
            "awsCredentials.externalId": externalId,
        });
    }

    const existing = await getCredentials(targetUserId, provider);
    await upsertCloudConnection(
        targetUserId,
        provider,
        buildConnection(provider, { ...credentialFields(existing), externalId }, {
            connectionId: existing?.connectionId || provider,
            connectedAt: existing?.connectedAt ? new Date(existing.connectedAt) : undefined,
            enabledModules: existing?.enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: existing?.logForwardingEnabled || false,
        })
    );
}

export async function saveRoleArn(userId: string, roleArn: string, provider: CloudProvider = "aws"): Promise<void> {
    const targetUserId = await resolveTargetUserId(userId);
    const connectedAt = new Date();
    if (provider === "aws") {
        await User.findByIdAndUpdate(targetUserId, {
            "awsCredentials.roleArn": roleArn,
            "awsCredentials.connectedAt": connectedAt,
        });
    }

    const existing = await getCredentials(targetUserId, provider);
    await upsertCloudConnection(
        targetUserId,
        provider,
        buildConnection(provider, { ...credentialFields(existing), roleArn }, {
            connectionId: existing?.connectionId || provider,
            connectedAt,
            enabledModules: existing?.enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: existing?.logForwardingEnabled || false,
        })
    );
}

export async function saveConnection(userId: string, roleArn: string, externalId: string, provider: CloudProvider = "aws"): Promise<void> {
    await saveConnectionWithModules(userId, roleArn, externalId, undefined, undefined, provider);
}

export async function saveConnectionWithModules(
    userId: string,
    roleArn: string,
    externalId: string,
    enabledModules: string[] = DEFAULT_MODULES,
    logForwardingEnabled: boolean = false,
    provider: CloudProvider = "aws"
): Promise<void> {
    const targetUserId = await resolveTargetUserId(userId);
    const connectedAt = new Date();
    if (provider === "aws") {
        await User.findByIdAndUpdate(targetUserId, {
            awsCredentials: {
                roleArn,
                externalId,
                connectedAt,
                enabledModules,
                logForwardingEnabled,
            },
        });
    }

    await upsertCloudConnection(
        targetUserId,
        provider,
        buildConnection(provider, { roleArn, externalId }, {
            connectionId: provider,
            connectedAt,
            enabledModules: enabledModules,
            logForwardingEnabled,
        })
    );

    try {
        clearAwsCredentialsCache(targetUserId);
        const { AwsInventoryCacheModel } = require("../models/aws-inventory-cache.model");
        await AwsInventoryCacheModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(targetUserId) });
        console.log(`[saveConnectionWithModules] Cleared AWS resource inventory cache for user ${targetUserId}`);
    } catch (err) {
        console.warn(`[saveConnectionWithModules] Failed to clear resource cache:`, err);
    }
}

export async function saveAzureConnection(
    userId: string,
    credentials: Pick<WorkspaceCredentials, "tenantId" | "subscriptionId" | "billingAccountId" | "clientId" | "clientSecret" | "principalId">,
    enabledModules?: string[],
    logForwardingEnabled?: boolean
): Promise<void> {
    const targetUserId = await resolveTargetUserId(userId);
    const connectedAt = new Date();
    await User.findByIdAndUpdate(targetUserId, {
        azureCredentials: {
            tenantId: credentials.tenantId,
            subscriptionId: credentials.subscriptionId,
            billingAccountId: credentials.billingAccountId,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            principalId: credentials.principalId,
            connectedAt,
            enabledModules: enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: logForwardingEnabled || false,
        },
    });

    await upsertCloudConnection(
        targetUserId,
        "azure",
        buildConnection("azure", credentials, {
            connectionId: credentials.subscriptionId || "azure",
            connectedAt,
            enabledModules: enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: logForwardingEnabled || false,
        })
    );

    try {
        const { AzureInventoryCacheModel } = require("../models/azure-inventory-cache.model");
        await AzureInventoryCacheModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(targetUserId) });
        console.log(`[saveAzureConnection] Cleared Azure resource inventory cache for user ${targetUserId}`);
    } catch (err) {
        console.warn(`[saveAzureConnection] Failed to clear resource cache:`, err);
    }
}

export async function saveGcpConnection(
    userId: string,
    credentials: Pick<WorkspaceCredentials, "projectId" | "clientEmail" | "privateKey" | "billingDatasetId" | "billingTableId">,
    enabledModules?: string[],
    logForwardingEnabled?: boolean
): Promise<void> {
    const targetUserId = await resolveTargetUserId(userId);
    const connectedAt = new Date();
    const normalizedPrivateKey = credentials.privateKey ? credentials.privateKey.replace(/\\n/g, "\n") : "";
    await User.findByIdAndUpdate(targetUserId, {
        gcpCredentials: {
            projectId: credentials.projectId,
            clientEmail: credentials.clientEmail,
            privateKey: normalizedPrivateKey,
            billingDatasetId: credentials.billingDatasetId,
            billingTableId: credentials.billingTableId,
            connectedAt,
            enabledModules: enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: logForwardingEnabled || false,
        },
    });

    await upsertCloudConnection(
        targetUserId,
        "gcp",
        buildConnection("gcp", {
            ...credentials,
            privateKey: normalizedPrivateKey,
        }, {
            connectionId: credentials.projectId || "gcp",
            connectedAt,
            enabledModules: enabledModules || DEFAULT_MODULES,
            logForwardingEnabled: logForwardingEnabled || false,
        })
    );

    try {
        const { GcpInventoryCacheModel } = require("../models/gcp-inventory-cache.model");
        await GcpInventoryCacheModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(targetUserId) });
        console.log(`[saveGcpConnection] Cleared GCP resource inventory cache for user ${targetUserId}`);
    } catch (err) {
        console.warn(`[saveGcpConnection] Failed to clear resource cache:`, err);
    }
}

export async function updateEnabledModules(
    userId: string,
    enabledModules: string[],
    logForwardingEnabled?: boolean,
    provider: CloudProvider = "aws"
): Promise<void> {
    const targetUserId = await resolveTargetUserId(userId);
    const update: any = {
        "cloudConnections.$[connection].enabledModules": enabledModules,
    };
    if (provider === "aws") {
        update["awsCredentials.enabledModules"] = enabledModules;
    }
    if (typeof logForwardingEnabled === "boolean") {
        update["cloudConnections.$[connection].logForwardingEnabled"] = logForwardingEnabled;
        if (provider === "aws") {
            update["awsCredentials.logForwardingEnabled"] = logForwardingEnabled;
        }
    }
    await User.findByIdAndUpdate(
        targetUserId,
        { $set: update },
        { arrayFilters: [{ "connection.provider": provider }] }
    );
}

export async function disconnectProvider(userId: string, provider: CloudProvider): Promise<void> {
    const targetUserId = await resolveTargetUserId(userId);
    const update: any = {
        $pull: { cloudConnections: { provider } },
    };
    if (provider === "aws") {
        update.$unset = { awsCredentials: 1 };
    } else if (provider === "azure") {
        update.$unset = { azureCredentials: 1 };
    } else if (provider === "gcp") {
        update.$unset = { gcpCredentials: 1 };
    }
    await User.findByIdAndUpdate(targetUserId, update);

    if (provider === "aws") {
        try {
            clearAwsCredentialsCache(targetUserId);
            const { AwsInventoryCacheModel } = require("../models/aws-inventory-cache.model");
            await AwsInventoryCacheModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(targetUserId) });
            const { OptimizationInsight, PricingModelSnapshot } = require("../models/optimization-cache.model");
            await OptimizationInsight.deleteMany({ userId: targetUserId });
            await PricingModelSnapshot.deleteMany({ userId: targetUserId });
            console.log(`[disconnectProvider] Cleared AWS resource inventory and optimization cache for user ${targetUserId}`);
        } catch (err) {
            console.warn(`[disconnectProvider] Failed to clear AWS caches:`, err);
        }
    } else if (provider === "azure") {
        try {
            const { AzureInventoryCacheModel } = require("../models/azure-inventory-cache.model");
            await AzureInventoryCacheModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(targetUserId) });
            console.log(`[disconnectProvider] Cleared Azure resource inventory cache for user ${targetUserId}`);
        } catch (err) {
            console.warn(`[disconnectProvider] Failed to clear Azure inventory cache:`, err);
        }
    } else if (provider === "gcp") {
        try {
            const { GcpInventoryCacheModel } = require("../models/gcp-inventory-cache.model");
            await GcpInventoryCacheModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(targetUserId) });
            console.log(`[disconnectProvider] Cleared GCP resource inventory cache for user ${targetUserId}`);
        } catch (err) {
            console.warn(`[disconnectProvider] Failed to clear GCP inventory cache:`, err);
        }
    }
}

export async function recordProviderSync(
    userId: string,
    provider: CloudProvider,
    status: "never" | "syncing" | "ok" | "partial" | "error",
    source: string,
    lastError?: string
): Promise<void> {
    const targetUserId = await resolveTargetUserId(userId);
    const now = new Date();
    const update: any = {
        $set: {
            "cloudConnections.$[connection].lastSyncAt": now,
            "cloudConnections.$[connection].lastSyncStatus": status,
            "cloudConnections.$[connection].source": source,
        }
    };

    if (status === "ok" || status === "partial") {
        update.$set["cloudConnections.$[connection].lastSuccessfulSyncAt"] = now;
        update.$unset = {
            "cloudConnections.$[connection].lastError": 1
        };
    } else if (status === "error") {
        update.$set["cloudConnections.$[connection].lastError"] = lastError || "Unknown error";
    }

    await User.findByIdAndUpdate(
        targetUserId,
        update,
        { arrayFilters: [{ "connection.provider": provider }] }
    );
}
