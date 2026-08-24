// AWS Credentials Service
import { getCredentials, isConnected } from "../../../../store/workspace-credentials";
import { CloudProvider } from "../../models/aws.model";
import { getProviderConnectionSummary } from "../../../../services/cloud/capabilities.service";

export async function getWorkspaceCredentials(userId: string, provider: CloudProvider = "aws") {
    const creds = await getCredentials(userId, provider);
    const connected = await isConnected(userId, provider);
    const summary = await getProviderConnectionSummary(userId, provider);
    const sharedFields = {
        status: summary.status,
        capabilities: summary.capabilities,
        metadata: summary.metadata,
        warnings: summary.warnings,
    };

    if (!connected) {
        return {
            connected: false,
            provider,
            roleArn: null,
            externalId: null,
            ...sharedFields,
        };
    }

    return {
        connected: true,
        provider,
        connectionId: creds?.connectionId ?? provider,
        roleArn: creds?.roleArn ?? null,
        externalId: creds?.externalId ?? null,
        tenantId: creds?.tenantId ?? null,
        subscriptionId: creds?.subscriptionId ?? null,
        billingAccountId: creds?.billingAccountId ?? null,
        clientId: creds?.clientId ?? null,
        projectId: creds?.projectId ?? null,
        clientEmail: creds?.clientEmail ?? null,
        billingDatasetId: creds?.billingDatasetId ?? null,
        billingTableId: creds?.billingTableId ?? null,
        connectedAt: creds?.connectedAt ?? null,
        ...sharedFields,
    };
}
