import {
    ResizeMigrationJobModel,
    ResizeMigrationTaskModel
} from "../../../models/resize-migration.model";
import { getGcpClient, getGcpSourceServerDetails } from "../planner";
import { runGcpTargetValidation } from "./validation";
import { matchAndEnrichTaskError } from "../../error-kb.service";

export async function runGcpTargetLaunch(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) return;
    const task = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "launch_target" });
    if (!task) return;

    task.status = "running";
    task.startedAt = new Date();
    task.logs = [{ level: "info", message: "Launching target Compute Engine VM...", timestamp: new Date() }];
    await task.save();

    const addLog = async (level: "info" | "warning" | "error", message: string) => {
        task.logs.push({ level, message, timestamp: new Date() });
        await task.save();
    };

    try {
        const { client, projectId } = await getGcpClient(userId);
        const sourceDetails = await getGcpSourceServerDetails(userId, job.region, job.sourceServerId);
        
        const bootDisk = sourceDetails.blockDeviceMappings.find((m: any) => m.boot);
        const targetZone = sourceDetails.zone;
        const snapshotPath = job.sourceSnapshotId;

        if (!snapshotPath) {
            throw new Error("Source snapshot ID is missing from migration job metadata.");
        }
        
        // 1. Create a cloned boot disk from the snapshot
        const diskName = `disk-${jobId.slice(-6)}-${Date.now()}`;
        await addLog("info", `Creating target boot disk ${diskName} in zone ${targetZone} from snapshot...`);
        
        const targetVolumeType = bootDisk?.volumeType || "pd-standard";
        const diskTypeUrl = `projects/${projectId}/zones/${targetZone}/diskTypes/${targetVolumeType}`;

        const diskOp = await client.compute.disks.insert({
            project: projectId,
            zone: targetZone,
            requestBody: {
                name: diskName,
                sourceSnapshot: snapshotPath,
                type: diskTypeUrl
            }
        });

        await addLog("info", `Disk creation operation initiated: ${diskOp.data.name}. Polling for completion...`);

        // Poll disk status
        let isDiskDone = false;
        let diskAttempts = 0;
        while (!isDiskDone && diskAttempts < 60) {
            diskAttempts++;
            await new Promise(r => setTimeout(r, 5000));
            const diskRes = await client.compute.disks.get({
                project: projectId,
                zone: targetZone,
                disk: diskName
            });
            const diskStatus = diskRes.data.status;
            await addLog("info", `Polling disk creation state: ${diskStatus}...`);
            if (diskStatus === "READY") {
                isDiskDone = true;
            } else if (diskStatus === "FAILED") {
                throw new Error("GCP disk creation from snapshot failed.");
            }
        }

        if (!isDiskDone) {
            throw new Error("Timeout waiting for cloned boot disk creation.");
        }

        // 2. Insert target instance using cloned boot disk and source VM's network interfaces
        const targetInstanceName = `${sourceDetails.name}-resized`;
        const targetMachineType = job.targetServerType;
        const machineTypeUrl = `zones/${targetZone}/machineTypes/${targetMachineType}`;

        const networkInterfaces = sourceDetails.networkInterfaces?.length > 0
            ? sourceDetails.networkInterfaces.map((nic: any) => ({
                network: nic.network || `global/networks/default`,
                subnetwork: nic.subnetwork || undefined,
                accessConfigs: [
                    {
                        type: "ONE_TO_ONE_NAT",
                        name: "External NAT"
                    }
                ]
            }))
            : [
                {
                    network: `global/networks/default`,
                    accessConfigs: [
                        {
                            type: "ONE_TO_ONE_NAT",
                            name: "External NAT"
                        }
                    ]
                }
            ];

        await addLog("info", `Launching target VM instance ${targetInstanceName} with machine type ${targetMachineType} in zone ${targetZone}...`);

        const vmOp = await client.compute.instances.insert({
            project: projectId,
            zone: targetZone,
            requestBody: {
                name: targetInstanceName,
                machineType: machineTypeUrl,
                disks: [
                    {
                        boot: true,
                        source: `zones/${targetZone}/disks/${diskName}`,
                        autoDelete: true
                    }
                ],
                networkInterfaces
            }
        });

        await addLog("info", `VM launch operation initiated: ${vmOp.data.name}. Polling VM state...`);

        // Poll VM status
        let targetInstance: any = null;
        let isVmReady = false;
        let vmAttempts = 0;
        while (!isVmReady && vmAttempts < 60) {
            vmAttempts++;
            await new Promise(r => setTimeout(r, 5000));
            const instRes = await client.compute.instances.get({
                project: projectId,
                zone: targetZone,
                instance: targetInstanceName
            });
            const status = instRes.data?.status;
            await addLog("info", `Polling target VM status: ${status}...`);
            if (status === "RUNNING") {
                targetInstance = instRes.data;
                isVmReady = true;
            } else if (status === "TERMINATED" || status === "STOPPING") {
                throw new Error(`Target VM failed to start and reached status: ${status}`);
            }
        }

        if (!isVmReady || !targetInstance) {
            throw new Error("Timeout waiting for target VM instance to reach RUNNING state.");
        }

        // 3. Extract public and private IPs
        let targetPrivateIp = "";
        let targetPublicIp = "";
        if (targetInstance.networkInterfaces && targetInstance.networkInterfaces.length > 0) {
            const nic = targetInstance.networkInterfaces[0];
            targetPrivateIp = nic.networkIP || "";
            if (nic.accessConfigs && nic.accessConfigs.length > 0) {
                targetPublicIp = nic.accessConfigs[0].natIP || "";
            }
        }

        job.targetServerId = targetInstance.id ? String(targetInstance.id) : targetInstanceName;
        job.targetServerName = targetInstanceName;
        job.rollbackState = {
            targetInstanceName,
            diskName,
            snapshotName: snapshotPath.split("/").pop()!,
            zone: targetZone
        };
        job.metadata = {
            ...job.metadata,
            targetAccessProfile: {
                keyPairName: null,
                reusedSourceKeyPair: false,
                suggestedUsername: "ubuntu",
                launchedFromImageId: sourceDetails.imageId || "unknown",
                launchedFromImageName: "Ubuntu Server",
                platformDetails: "Ubuntu Server",
                userDataCopied: false,
                publicIp: targetPublicIp,
                privateIp: targetPrivateIp,
                publicDnsName: targetPublicIp
            }
        };
        job.markModified("rollbackState");
        job.markModified("metadata");
        await job.save();

        task.logs.push({ level: "info", message: `Compute Engine VM launched successfully. ID: ${job.targetServerId}`, timestamp: new Date() });
        task.status = "succeeded";
        task.completedAt = new Date();
        await task.save();

        job.status = "validating";
        await job.save();

        runGcpTargetValidation(jobId, userId).catch(err => {
            console.error("[GCP Launch Auto-Trigger Error]:", err);
        });
    } catch (err: any) {
        await matchAndEnrichTaskError("gcp", "launching_target", err, task);
        task.status = "failed";
        task.completedAt = new Date();
        await task.save();

        job.status = "failed";
        job.logs.push({ level: "error", message: `Target launch failed: ${err.message || err}`, timestamp: new Date() });
        await job.save();
    }
}
