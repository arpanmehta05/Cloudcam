// AWS Setup Service
import { saveExternalId } from "../../../../store/workspace-credentials";
import { config } from "../../../../core/config";
import crypto from "crypto";

export interface SetupOptions {
    enableAiObservability?: boolean;
    enableLogForwarding?: boolean;
}

export async function generateSetupLink(userId: string, options: SetupOptions = {}) {
    const externalId = crypto.randomUUID();
    await saveExternalId(userId, externalId);

    const bucketName = `rabbittize-cur-${userId.toLowerCase().slice(0, 8)}-${Math.random().toString(36).substring(7)}`;

    const enableAi = options.enableAiObservability !== false; // default true
    const enableLogs = options.enableLogForwarding === true;  // default false

    const params = new URLSearchParams({
        stackName: "Rabbittize-Integration",
        templateURL: config.rabbittize.templateUrl,
        param_RabbittizeWorkspaceID: userId,
        param_RabbittizeExternalID: externalId,
        param_RabbittizeTrustRoleArn: config.rabbittize.trustRoleArn,
        param_RabbittizePingbackArn: config.rabbittize.pingbackArn,
        param_BucketName: bucketName,
        param_ReportName: "RabbittizeCostReport",
        param_EnableAiObservability: enableAi ? "true" : "false",
        param_EnableLogForwarding: enableLogs ? "true" : "false",
    });

    // Only include webhook URL if log forwarding is enabled
    if (enableLogs && config.rabbittize.webhookUrl) {
        params.set("param_RabbittizeWebhookUrl", config.rabbittize.webhookUrl);
    }

    const quickCreateUrl = `https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/quickcreate?${params.toString()}`;

    return {
        quickCreateUrl,
        externalId,
        bucketName,
        enabledModules: [
            "core-monitoring",
            "cost",
            "security",
            ...(enableAi ? ["ai-observability"] : []),
        ],
        logForwardingEnabled: enableLogs,
    };
}
