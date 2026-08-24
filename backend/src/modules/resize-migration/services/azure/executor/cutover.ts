import { IResizeMigrationTask, ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../../../models/resize-migration.model";
import { getCredentials } from "../../../../../store/workspace-credentials";
import { matchAndEnrichTaskError, recordSuccessfulFallback } from "../../error-kb.service";
import { callAzureAPI } from "../planner";

export async function runAzureTargetCutover(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;

    const awaitTask = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "await_cutover" });
    if (!awaitTask) return;

    const preserveTask = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "preserve_source" });
    if (!preserveTask) return;

    awaitTask.status = "running";
    awaitTask.startedAt = new Date();
    awaitTask.logs = [{ level: "info", message: "Executing Azure VM cutover traffic rerouting.", timestamp: new Date() }];
    await awaitTask.save();

    const addLog = async (task: IResizeMigrationTask, level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        const creds = (await getCredentials(userId, "azure"))!;
        
        if (job.cutoverMode === "elastic_ip") {
            const pipId = job.rollbackState?.publicIpId;
            const targetNicId = job.rollbackState?.clonedNicId;
            const sourceNicId = job.rollbackState?.sourceNicId;

            if (!pipId || !targetNicId || !sourceNicId) {
                throw {
                    code: "AZURE_PUBLIC_IP_ASSOCIATION_FAILED",
                    message: "Public IP ID or NIC mapping not set in job configuration rollbackState.",
                    fix: "Switch cutover mode to Manual / DNS to perform cutover manually."
                };
            }

            await addLog(awaitTask, "info", `Fetching source NIC configuration...`);
            const sourceNic = await callAzureAPI(creds, "GET", sourceNicId, null, "2023-11-01");
            const targetNic = await callAzureAPI(creds, "GET", targetNicId, null, "2023-11-01");

            await addLog(awaitTask, "info", `Disassociating Public IP ${pipId} from source NIC...`);
            sourceNic.properties.ipConfigurations[0].properties.publicIPAddress = null;
            await callAzureAPI(creds, "PUT", sourceNicId, sourceNic, "2023-11-01");

            await addLog(awaitTask, "info", `Associating Public IP ${pipId} to target NIC...`);
            targetNic.properties.ipConfigurations[0].properties.publicIPAddress = { id: pipId };
            await callAzureAPI(creds, "PUT", targetNicId, targetNic, "2023-11-01");

            await addLog(awaitTask, "info", `Successfully transferred Azure Public IP to target NIC.`);
            
            job.rollbackState = {
                ...job.rollbackState,
                cutoverApplied: true
            };
            job.markModified("rollbackState");
            await job.save();
        } else if (job.cutoverMode === "dns") {
            const dnsConfig = job.metadata?.dnsConfig;
            if (dnsConfig && dnsConfig.zoneName && (dnsConfig.domainName || dnsConfig.relativeRecordSetName)) {
                const zoneName = dnsConfig.zoneName;
                const resourceGroupName = dnsConfig.resourceGroupName || "default-rg";
                const recordType = dnsConfig.recordType || "A";
                const ttl = dnsConfig.ttl || 300;
                
                let relativeRecordSetName = dnsConfig.relativeRecordSetName || "@";
                if (!dnsConfig.relativeRecordSetName && dnsConfig.domainName) {
                    const domain = dnsConfig.domainName.trim();
                    const zone = zoneName.trim();
                    if (domain === zone) {
                        relativeRecordSetName = "@";
                    } else if (domain.endsWith("." + zone)) {
                        relativeRecordSetName = domain.slice(0, -(zone.length + 1));
                    } else {
                        relativeRecordSetName = domain;
                    }
                }

                let targetPublicIp = "127.0.0.1";
                try {
                    await addLog(awaitTask, "info", `Fetching target VM details to obtain Public IP...`);
                    const targetVmPath = job.targetServerId!;
                    const vmDetails = await callAzureAPI(creds, "GET", targetVmPath, null, "2023-09-01");
                    
                    const nicId = vmDetails.properties.networkProfile.networkInterfaces[0].id;
                    const nicDetails = await callAzureAPI(creds, "GET", nicId, null, "2023-11-01");
                    const pipId = nicDetails.properties.ipConfigurations[0].properties.publicIPAddress?.id;
                    if (pipId) {
                        const pipDetails = await callAzureAPI(creds, "GET", pipId, null, "2023-11-01");
                        targetPublicIp = pipDetails.properties.ipAddress || "127.0.0.1";
                    }
                } catch (ipErr: any) {
                    await addLog(awaitTask, "warning", `Failed to automatically retrieve target VM public IP: ${ipErr.message || ipErr}. Using fallback.`);
                }

                await addLog(awaitTask, "info", `DNS Cutover active: Updating Azure DNS Zone ${zoneName} record '${relativeRecordSetName}' (${recordType}) to point to IP ${targetPublicIp}...`);

                try {
                    const dnsRecordPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Network/dnsZones/${zoneName}/${recordType}/${relativeRecordSetName}`;
                    const dnsBody = {
                        properties: {
                            TTL: ttl,
                            ARecords: [
                                {
                                    ipv4Address: targetPublicIp
                                }
                            ]
                        }
                    };
                    await callAzureAPI(creds, "PUT", dnsRecordPath, dnsBody, "2018-05-01");
                    await addLog(awaitTask, "info", `Successfully updated Azure DNS record '${relativeRecordSetName}.${zoneName}' to target IP ${targetPublicIp}.`);
                } catch (dnsErr: any) {
                    await addLog(awaitTask, "warning", `Failed to automatically update Azure DNS record: ${dnsErr.message || dnsErr}. Falling back to manual instructions.`);
                    await addLog(awaitTask, "info", `DNS / Manual Cutover instructions: Point your domain to target VM Public IP: ${targetPublicIp}.`);
                }
            } else {
                await addLog(awaitTask, "warning", "DNS cutover mode active, but zoneName/domainName is missing from metadata.dnsConfig. Falling back to manual instructions.");
                await addLog(awaitTask, "info", "DNS / Manual Cutover instructions: Point your domain to target VM Public IP.");
            }
        } else {
            await addLog(awaitTask, "info", `Cutover mode: ${job.cutoverMode}. No automatic IP association performed.`);
        }

        awaitTask.status = "succeeded";
        awaitTask.completedAt = new Date();
        await awaitTask.save();

        // 2. Shut down Source Server if requested
        preserveTask.status = "running";
        preserveTask.startedAt = new Date();
        preserveTask.logs = [{ level: "info", message: "Updating source VM state.", timestamp: new Date() }];
        await preserveTask.save();

        const stopSource = Boolean(job.metadata?.stopSourceAfterCutover);
        if (stopSource) {
            await addLog(preserveTask, "info", `Stopping source VM ${job.sourceServerId}...`);
            await callAzureAPI(creds, "POST", `${job.sourceServerId}/powerOff`, null, "2023-09-01");
            await addLog(preserveTask, "info", "Source VM has been stopped.");
        } else {
            await addLog(preserveTask, "info", "Keeping source VM running as requested by configuration.");
        }

        preserveTask.status = "succeeded";
        preserveTask.completedAt = new Date();
        await preserveTask.save();

        job.status = "completed";
        await job.save();
    } catch (err: any) {
        await matchAndEnrichTaskError("azure", "cutover", err, awaitTask);
        awaitTask.status = "failed";
        awaitTask.completedAt = new Date();
        await awaitTask.save();

        job.status = "failed";
        job.logs.push({ level: "error", message: `Cutover failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}

export async function runAzureTargetRollback(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;

    job.logs.push({ level: "info", message: "Starting rollback operations for Azure VM.", timestamp: new Date() });
    await job.save();

    try {
        const creds = (await getCredentials(userId, "azure"))!;
        
        // Skip uncompleted timeline tasks
        const tasks = await ResizeMigrationTaskModel.find({ jobId, userId });
        for (const t of tasks) {
            if (t.status !== "succeeded") {
                t.status = "skipped";
                await t.save();
            }
        }

        // Re-associate IP back if it was transferred
        if (job.rollbackState?.cutoverApplied && job.rollbackState?.publicIpId) {
            const pipId = job.rollbackState.publicIpId;
            const targetNicId = job.rollbackState.clonedNicId;
            const sourceNicId = job.rollbackState.sourceNicId;

            job.logs.push({ level: "info", message: `Rollback: Reassociating Public IP back to source...`, timestamp: new Date() });
            await job.save();

            const sourceNic = await callAzureAPI(creds, "GET", sourceNicId, null, "2023-11-01");
            const targetNic = await callAzureAPI(creds, "GET", targetNicId, null, "2023-11-01");

            targetNic.properties.ipConfigurations[0].properties.publicIPAddress = null;
            await callAzureAPI(creds, "PUT", targetNicId, targetNic, "2023-11-01");

            sourceNic.properties.ipConfigurations[0].properties.publicIPAddress = { id: pipId };
            await callAzureAPI(creds, "PUT", sourceNicId, sourceNic, "2023-11-01");
        }

        // Start source VM if stopped
        job.logs.push({ level: "info", message: `Rollback: Starting source VM...`, timestamp: new Date() });
        await job.save();

        await callAzureAPI(creds, "POST", `${job.sourceServerId}/start`, null, "2023-09-01");

        // Record successful fallback
        if (job.rollbackState?.cutoverApplied) {
            await recordSuccessfulFallback("azure", "cutover", "AZURE_PUBLIC_IP_ASSOCIATION_FAILED");
        }

        job.status = "rolled_back";
        job.completedAt = new Date();
        job.logs.push({ level: "info", message: "Azure VM rollback completed. Source VM remains running.", timestamp: new Date() });
        await job.save();
    } catch (err: any) {
        console.error(`[Azure Rollback Error] Job ${jobId}:`, err);
        job.status = "failed";
        job.logs.push({ level: "error", message: `Rollback failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}
