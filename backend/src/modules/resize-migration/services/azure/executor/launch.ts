import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../../../models/resize-migration.model";
import { getCredentials } from "../../../../../store/workspace-credentials";
import { matchAndEnrichTaskError } from "../../error-kb.service";
import { callAzureAPI, getAzureSourceServerDetails } from "../planner";
import { cleanupPreexistingResources } from "./cleanup";
import { runAzureTargetValidation } from "./validation";

export async function runAzureTargetLaunch(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;

    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "launch_target" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Launching target Azure VM from cloned OS Disk.", timestamp: new Date() }];
    await task.save();

    const addLog = async (level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        const creds = (await getCredentials(userId, "azure"))!;
        const sourceDetails = await getAzureSourceServerDetails(userId, job.region, job.sourceServerId);
        const rg = sourceDetails.resourceGroup;
        const location = job.region;

        const targetDiskName = `disk-target-${jobId.slice(-6)}`;
        const targetDiskPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Compute/disks/${targetDiskName}`;

        const targetNicName = `nic-target-${jobId.slice(-6)}`;
        const targetNicPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${targetNicName}`;

        const targetVmName = `vm-target-${jobId.slice(-6)}`;
        const targetVmPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Compute/virtualMachines/${targetVmName}`;

        const targetPipName = `pip-target-${jobId.slice(-6)}`;
        const targetPipPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${targetPipName}`;

        // Cleanup pre-existing resources
        await cleanupPreexistingResources(creds, rg, jobId, addLog);

        // 1. Create Target Managed Disk from Snapshot
        await addLog("info", `Creating cloned OS Managed Disk ${targetDiskName} from snapshot...`);
        await callAzureAPI(creds, "PUT", targetDiskPath, {
            location,
            sku: { name: sourceDetails.blockDeviceMappings[0]?.volumeType || "Premium_LRS" },
            properties: {
                creationData: {
                    createOption: "Copy",
                    sourceResourceId: job.sourceSnapshotId
                },
                osType: sourceDetails.osType
            }
        }, "2023-04-02");

        let diskDone = false;
        let attempts = 0;
        while (!diskDone && attempts < 40) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000));
            const disk = await callAzureAPI(creds, "GET", targetDiskPath, null, "2023-04-02");
            if (disk.properties?.provisioningState === "Succeeded") {
                diskDone = true;
            }
        }
        if (!diskDone) throw new Error("Timeout creating cloned Managed Disk.");

        let targetPublicIp = null;
        let createdPip = false;
        
        try {
            await addLog("info", `Creating target Public IP address ${targetPipName}...`);
            await callAzureAPI(creds, "PUT", targetPipPath, {
                location,
                sku: { name: "Standard" },
                properties: {
                    publicIPAllocationMethod: "Static",
                    publicIPAddressVersion: "IPv4"
                }
            }, "2023-11-01");

            let pipDone = false;
            let pipAttempts = 0;
            while (!pipDone && pipAttempts < 20) {
                pipAttempts++;
                await new Promise(r => setTimeout(r, 3050));
                const pip = await callAzureAPI(creds, "GET", targetPipPath, null, "2023-11-01");
                if (pip.properties?.provisioningState === "Succeeded") {
                    pipDone = true;
                    targetPublicIp = pip.properties?.ipAddress || null;
                }
            }
            if (!pipDone) {
                await addLog("warning", "Timeout creating target Public IP address. Target launch will proceed without a public IP.");
            } else {
                createdPip = true;
            }
        } catch (err: any) {
            const isAuthError = err.code === "AuthorizationFailed" || /authorization|permission|forbidden/i.test(err.message || "");
            if (isAuthError) {
                await addLog("warning", `Insufficient permissions to create Public IP address (VM Contributor mode). Proceeding without public IP.`);
            } else {
                await addLog("warning", `Failed to create target Public IP address: ${err.message || err}. Proceeding without public IP.`);
            }
            console.warn("[azure-resize-migration.service] Failed to create target Public IP:", err);
        }

        // 2. Create Target NIC
        await addLog("info", `Creating target network interface ${targetNicName}...`);
        const nicProperties: any = {
            ipConfigurations: [
                {
                    name: "ipconfig1",
                    properties: {
                        subnet: { id: sourceDetails.subnetId },
                        privateIPAllocationMethod: "Dynamic"
                    }
                }
            ]
        };

        if (createdPip) {
            nicProperties.ipConfigurations[0].properties.publicIPAddress = {
                id: targetPipPath
            };
        }

        if (sourceDetails.networkSecurityGroupId) {
            await addLog("info", `Associating cloned Network Security Group ${sourceDetails.networkSecurityGroupId.split("/").pop()} with target NIC...`);
            nicProperties.networkSecurityGroup = {
                id: sourceDetails.networkSecurityGroupId
            };
        }

        await callAzureAPI(creds, "PUT", targetNicPath, {
            location,
            properties: nicProperties
        }, "2023-11-01");

        let nicDone = false;
        attempts = 0;
        while (!nicDone && attempts < 20) {
            attempts++;
            await new Promise(r => setTimeout(r, 3000));
            const nic = await callAzureAPI(creds, "GET", targetNicPath, null, "2023-11-01");
            if (nic.properties?.provisioningState === "Succeeded") {
                nicDone = true;
            }
        }
        if (!nicDone) throw new Error("Timeout creating target network interface.");

        // 3. Create target VM
        await addLog("info", `Creating target VM ${targetVmName} of size ${job.targetServerType}...`);
        await callAzureAPI(creds, "PUT", targetVmPath, {
            location,
            properties: {
                hardwareProfile: { vmSize: job.targetServerType },
                storageProfile: {
                    osDisk: {
                        name: targetDiskName,
                        createOption: "Attach",
                        managedDisk: { id: targetDiskPath },
                        osType: sourceDetails.osType
                    }
                },
                networkProfile: {
                    networkInterfaces: [
                        { id: targetNicPath }
                    ]
                }
            }
        }, "2023-09-01");

        let vmDone = false;
        attempts = 0;
        while (!vmDone && attempts < 60) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000));
            const vm = await callAzureAPI(creds, "GET", targetVmPath, null, "2023-09-01");
            if (vm.properties?.provisioningState === "Succeeded") {
                vmDone = true;
            }
        }
        if (!vmDone) throw new Error("Timeout deploying target Azure VM.");

        await addLog("info", `Target VM launched successfully. ID: ${targetVmPath}`);
        
        job.targetServerId = targetVmPath;
        job.targetServerName = targetVmName;

        let targetPrivateIp = null;
        try {
            const nic = await callAzureAPI(creds, "GET", targetNicPath, null, "2023-11-01");
            targetPrivateIp = nic.properties?.ipConfigurations?.[0]?.properties?.privateIPAddress || null;
            if (createdPip && !targetPublicIp) {
                const pipId = nic.properties?.ipConfigurations?.[0]?.properties?.publicIPAddress?.id;
                if (pipId) {
                    const pip = await callAzureAPI(creds, "GET", pipId, null, "2023-11-01");
                    targetPublicIp = pip.properties?.ipAddress || null;
                }
            }
        } catch (err) {
            console.warn("[azure-resize-migration.service] Failed to get target NIC for private IP metadata:", err);
        }

        job.metadata = {
            ...job.metadata,
            targetAccessProfile: {
                keyPairName: null,
                reusedSourceKeyPair: false,
                suggestedUsername: sourceDetails.adminUsername || job.accessConfig?.username || null,
                launchedFromImageId: sourceDetails.imageId || null,
                launchedFromImageName: sourceDetails.osType || null,
                platformDetails: sourceDetails.osType || null,
                userDataCopied: false,
                publicIp: targetPublicIp,
                privateIp: targetPrivateIp,
                publicDnsName: null
            }
        };
        job.markModified("metadata");
        job.rollbackState = {
            clonedDiskId: targetDiskPath,
            clonedNicId: targetNicPath,
            clonedVmId: targetVmPath,
            clonedPipId: createdPip ? targetPipPath : null,
            sourceNicId: sourceDetails.networkInterfaceId || `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/nic-source-${jobId.slice(-6)}`,
            publicIpId: sourceDetails.publicIpId,
        };
        job.markModified("rollbackState");
        await job.save();

        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        job.status = "validating";
        await job.save();

        runAzureTargetValidation(jobId, userId).catch(err => {
            console.error("[Launch Auto-Trigger Error]:", err);
        });
    } catch (err: any) {
        await matchAndEnrichTaskError("azure", "launching_target", err, task);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        job.status = "failed";
        job.logs.push({ level: "error", message: `Launch task failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}
