import { MigrationErrorPatternModel } from "../models/resize-migration.model";

const defaultErrorPatterns = [
    // --- AWS ---
    {
        provider: "aws",
        step: "any",
        errorSignature: "UnauthorizedOperation",
        errorCode: "AWS_UNAUTHORIZED_OPERATION",
        likelyCause: "Missing AWS IAM permissions for EC2 action.",
        fixSuggestion: "Grant the required EC2 policy permissions (such as ec2:CreateImage, ec2:RunInstances, or ec2:AssociateAddress) to your IAM role, or reconnect credentials with a higher privilege role.",
        fallbackOption: "Stop the migration and review credential setup in Settings.",
        retryable: true
    },
    {
        provider: "aws",
        step: "launching_target",
        errorSignature: "InvalidInstanceType",
        errorCode: "AWS_INVALID_INSTANCE_TYPE",
        likelyCause: "The selected target instance type is not supported or out of capacity in the chosen availability zone/subnet.",
        fixSuggestion: "Select a different target size (e.g. switch between t3 and m5 families) or choose a subnet in a different availability zone.",
        fallbackOption: "Try launching with a different, compatible instance size option.",
        retryable: true
    },
    {
        provider: "aws",
        step: "launching_target",
        errorSignature: "InvalidAMIID.NotFound",
        errorCode: "AWS_AMI_NOT_FOUND",
        likelyCause: "The source AMI was not found, is still initializing, or belongs to another region/account.",
        fixSuggestion: "Verify that the source image creation task completed successfully and that the AMI exists in the current AWS region.",
        fallbackOption: "Re-run the AMI creation step or choose a pre-existing AMI.",
        retryable: true
    },
    {
        provider: "aws",
        step: "cutover",
        errorSignature: "InvalidAddress.NotFound",
        errorCode: "AWS_EIP_NOT_FOUND",
        likelyCause: "The Elastic IP address associated with the source server could not be located or belongs to a different region.",
        fixSuggestion: "Confirm that the Elastic IP exists on AWS in the current region, or switch cutover mode to Manual/DNS.",
        fallbackOption: "Switch to Manual/DNS cutover mode and route traffic manually.",
        retryable: true
    },
    {
        provider: "aws",
        step: "validating",
        errorSignature: "Target instance is not in 'running' state",
        errorCode: "AWS_TARGET_NOT_RUNNING",
        likelyCause: "The launched target server stopped, failed to start, or terminated during boot.",
        fixSuggestion: "Review target server launch configurations, check instance system status checks, or check AWS EC2 console for instance state.",
        fallbackOption: "Re-launch target server or verify AWS capacity.",
        retryable: true
    },

    // --- Azure ---
    {
        provider: "azure",
        step: "any",
        errorSignature: "AuthorizationFailed",
        errorCode: "AZURE_UNAUTHORIZED_OPERATION",
        likelyCause: "The provided Azure Client ID or Client Secret lacks required permissions on the resource group or subscription.",
        fixSuggestion: "Grant the appropriate Contributor or Owner role to your service principal in the Azure Portal, or check subscription access.",
        fallbackOption: "Stop the migration and verify credentials under Settings -> Integrations.",
        retryable: true
    },
    {
        provider: "azure",
        step: "launching_target",
        errorSignature: "SkuNotAvailable",
        errorCode: "AZURE_SKU_UNAVAILABLE",
        likelyCause: "The target VM size (SKU) is not available or has restricted quota in the selected region or zone.",
        fixSuggestion: "Select an alternative Azure VM size (e.g. D2s_v3 or B2ms) that is available in your target location and has quota.",
        fallbackOption: "Choose a different target VM size profile.",
        retryable: true
    },
    {
        provider: "azure",
        step: "snapshotting",
        errorSignature: "ResourceNotFound",
        errorCode: "AZURE_DISK_NOT_FOUND",
        likelyCause: "The OS disk associated with the source VM was not found or is undergoing maintenance.",
        fixSuggestion: "Confirm that the source Virtual Machine has a valid managed OS disk attached and active in the Azure Portal.",
        fallbackOption: "Verify source server health state and retry.",
        retryable: true
    },
    {
        provider: "azure",
        step: "cutover",
        errorSignature: "PublicIPAddressCannotBeReassociated",
        errorCode: "AZURE_PUBLIC_IP_ASSOCIATION_FAILED",
        likelyCause: "The source public IP address is dynamically allocated or has conflicting associations.",
        fixSuggestion: "Change the public IP allocation type to Static in Azure, or choose Manual/DNS cutover mode.",
        fallbackOption: "Switch cutover mode to Manual/DNS and update your DNS records manually.",
        retryable: true
    },
    {
        provider: "azure",
        step: "validating",
        errorSignature: "Target instance is not in 'running' state",
        errorCode: "AZURE_TARGET_NOT_RUNNING",
        likelyCause: "The launched target VM has stopped or failed to boot due to configuration issues.",
        fixSuggestion: "Review boot diagnostics logs in the Azure Portal or check target VM configurations.",
        fallbackOption: "Re-launch target VM or verify compute availability in the region.",
        retryable: true
    }
];

export async function seedMigrationErrorPatterns(): Promise<void> {
    try {
        const count = await MigrationErrorPatternModel.countDocuments();
        if (count === 0) {
            console.log("[ErrorKB] Seeding default error patterns...");
            await MigrationErrorPatternModel.insertMany(defaultErrorPatterns);
            console.log(`[ErrorKB] Successfully seeded ${defaultErrorPatterns.length} default error patterns.`);
        }
    } catch (err) {
        console.error("[ErrorKB] Failed to seed error patterns:", err);
    }
}

export async function matchAndEnrichTaskError(
    provider: string,
    step: string,
    error: any,
    task: any
): Promise<void> {
    try {
        const message = String(error.message || error).toLowerCase();
        const code = String(error.code || "").toLowerCase();

        // Find matches for specific step or "any"
        const patterns = await MigrationErrorPatternModel.find({
            provider,
            $or: [{ step }, { step: "any" }]
        });

        const matched = patterns.find(p => {
            const sig = p.errorSignature.toLowerCase();
            return message.includes(sig) || code.includes(sig);
        });

        if (matched) {
            task.errorCode = matched.errorCode;
            task.errorMessage = error.message || String(error);
            task.fixSuggestion = matched.fixSuggestion;
            task.fallbackOptions = [matched.fallbackOption];
            task.retryable = matched.retryable;

            // Update stats
            matched.timesSeen += 1;
            matched.lastSeenAt = new Date();
            await matched.save();

            console.log(`[ErrorKB] Matched error code '${task.errorCode}' with knowledge base pattern.`);
        } else {
            task.errorCode = error.code || "UNKNOWN_ERROR";
            task.errorMessage = error.message || String(error);
            task.retryable = true;
        }
    } catch (err) {
        console.error("[ErrorKB] Error matching task error:", err);
        task.errorCode = error.code || "UNKNOWN_ERROR";
        task.errorMessage = error.message || String(error);
        task.retryable = true;
    }
}

export async function recordSuccessfulFallback(
    provider: string,
    step: string,
    errorCode: string
): Promise<void> {
    try {
        const pattern = await MigrationErrorPatternModel.findOne({
            provider,
            step,
            errorCode
        });

        if (pattern) {
            pattern.timesFallbackWorked += 1;
            await pattern.save();
            console.log(`[ErrorKB] Recorded successful fallback for error code '${errorCode}'. Total: ${pattern.timesFallbackWorked}`);
        }
    } catch (err) {
        console.error("[ErrorKB] Failed to record successful fallback:", err);
    }
}
