import {
    EC2Client,
    DescribeInstancesCommand,
    DescribeAddressesCommand,
    AssociateAddressCommand,
    StopInstancesCommand
} from "@aws-sdk/client-ec2";
import { getCredentials } from "@/store/workspace-credentials";
import { getClientConfig } from "@/providers/aws/client-factory";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "@/modules/resize-migration/models/resize-migration.model";
import { matchAndEnrichTaskError } from "@/modules/resize-migration/services/error-kb.service";

export async function runAwsTargetCutover(jobId: string, userId: string): Promise<void> {
    const job = await ResizeMigrationJobModel.findOne({ _id: jobId, userId });
    if (!job) {
        console.error(`[TargetCutover] Job ${jobId} not found.`);
        return;
    }

    const awaitTask = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "await_cutover" });
    const preserveTask = await ResizeMigrationTaskModel.findOne({ jobId, userId, key: "preserve_source" });

    if (!awaitTask || !preserveTask) {
        console.error(`[TargetCutover] Core tasks for job ${jobId} not found.`);
        return;
    }

    awaitTask.status = "running";
    awaitTask.startedAt = new Date();
    awaitTask.logs = [
        {
            level: "info",
            message: "Initiating cutover execution tasks.",
            timestamp: new Date()
        }
    ];
    await awaitTask.save();

    const addLog = async (taskDoc: any, level: "info" | "warning" | "error", message: string) => {
        taskDoc.logs.push({ level, message, timestamp: new Date() });
        await taskDoc.save();
    };

    try {
        const region = job.region;
        const sourceServerId = job.sourceServerId;
        const targetServerId = job.targetServerId;

        if (!targetServerId) {
            throw new Error("Target instance ID is missing from the job details.");
        }

        await addLog(awaitTask, "info", "Checking AWS credential connection status...");
        const creds = await getCredentials(userId, "aws");
        if (!creds || !creds.roleArn || !creds.externalId) {
            throw new Error("AWS credentials not found or incomplete.");
        }

        const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
        const client = new EC2Client(cfg);

        // Describe target to get its IPs for logging instructions
        const targetDesc = await client.send(new DescribeInstancesCommand({ InstanceIds: [targetServerId] }));
        const targetInstance = targetDesc.Reservations?.[0]?.Instances?.[0];
        const targetPublicIp = targetInstance?.PublicIpAddress || "N/A";
        const targetPrivateIp = targetInstance?.PrivateIpAddress || "N/A";

        if (job.cutoverMode === "elastic_ip") {
            await addLog(awaitTask, "info", `Searching for Elastic IP associated with source instance ${sourceServerId}...`);
            const addrRes = await client.send(new DescribeAddressesCommand({
                Filters: [{ Name: "instance-id", Values: [sourceServerId] }]
            }));
            const address = addrRes.Addresses?.[0];

            if (address && address.AllocationId && address.PublicIp) {
                await addLog(awaitTask, "info", `Found Elastic IP ${address.PublicIp} (Allocation: ${address.AllocationId}). Moving to target instance ${targetServerId}...`);
                await client.send(new AssociateAddressCommand({
                    AllocationId: address.AllocationId,
                    InstanceId: targetServerId,
                    AllowReassociation: true
                }));
                await addLog(awaitTask, "info", `Successfully reassociated Elastic IP ${address.PublicIp} to target instance ${targetServerId}.`);
            } else {
                await addLog(awaitTask, "warning", "No Elastic IP associated with the source server. Falling back to manual DNS / cutover instructions.");
                await addLog(awaitTask, "info", `DNS / Manual Cutover instructions: Update your DNS A/AAAA records or load balancer targets to point to the target server's IP address (Public: ${targetPublicIp}, Private: ${targetPrivateIp}).`);
            }
        } else if (job.cutoverMode === "dns") {
            const dnsConfig = job.metadata?.dnsConfig;
            if (dnsConfig && dnsConfig.hostedZoneId && dnsConfig.domainName) {
                const recordType = dnsConfig.recordType || "A";
                const ttl = dnsConfig.ttl || 300;
                await addLog(awaitTask, "info", `DNS Cutover active: Updating Route 53 record set ${dnsConfig.domainName} (${recordType}) in Hosted Zone ${dnsConfig.hostedZoneId} to target IP ${targetPublicIp}...`);
                
                try {
                    const { Route53Client, ChangeResourceRecordSetsCommand } = await import("@aws-sdk/client-route-53");
                    const route53 = new Route53Client(cfg);
                    await route53.send(new ChangeResourceRecordSetsCommand({
                        HostedZoneId: dnsConfig.hostedZoneId,
                        ChangeBatch: {
                            Comment: `Rabbittwatch automatic resize migration cutover to target VM ${targetServerId}`,
                            Changes: [
                                {
                                    Action: "UPSERT",
                                    ResourceRecordSet: {
                                        Name: dnsConfig.domainName,
                                        Type: recordType,
                                        TTL: ttl,
                                        ResourceRecords: [
                                            {
                                                Value: targetPublicIp
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }));
                    await addLog(awaitTask, "info", `Successfully updated Route 53 DNS record ${dnsConfig.domainName} to target IP ${targetPublicIp}.`);
                } catch (dnsErr: any) {
                    await addLog(awaitTask, "warning", `Failed to automatically update Route 53 DNS record: ${dnsErr.message || dnsErr}. Falling back to manual cutover instructions.`);
                    await addLog(awaitTask, "info", `DNS / Manual Cutover instructions: Update your DNS A/AAAA records or load balancer targets to point to the target server's IP address (Public: ${targetPublicIp}, Private: ${targetPrivateIp}).`);
                }
            } else {
                await addLog(awaitTask, "warning", "DNS cutover mode active, but hostedZoneId or domainName is missing from metadata.dnsConfig. Falling back to manual instructions.");
                await addLog(awaitTask, "info", `DNS / Manual Cutover instructions: Update your DNS A/AAAA records or load balancer targets to point to the target server's IP address (Public: ${targetPublicIp}, Private: ${targetPrivateIp}).`);
            }
        } else {
            await addLog(awaitTask, "info", `DNS / Manual cutover strategy active. Instructions: Update your DNS A/AAAA records or load balancer targets to point to the target server's IP address (Public: ${targetPublicIp}, Private: ${targetPrivateIp}).`);
        }

        awaitTask.status = "succeeded";
        awaitTask.completedAt = new Date();
        await awaitTask.save();

        // 2. Preserve Source Task
        preserveTask.status = "running";
        preserveTask.startedAt = new Date();
        preserveTask.logs = [
            {
                level: "info",
                message: "Evaluating source server preservation policy.",
                timestamp: new Date()
            }
        ];
        await preserveTask.save();

        const stopSource = job.metadata?.stopSourceAfterCutover === true;
        if (stopSource) {
            await addLog(preserveTask, "info", `User requested to stop the source server. Stopping source instance ${sourceServerId}...`);
            await client.send(new StopInstancesCommand({ InstanceIds: [sourceServerId] }));
            await addLog(preserveTask, "info", `Stop command sent successfully to source instance ${sourceServerId}.`);
        } else {
            await addLog(preserveTask, "info", `Preservation policy: keeping source instance ${sourceServerId} running/preserved. (MVP never deletes it).`);
        }

        preserveTask.status = "succeeded";
        preserveTask.completedAt = new Date();
        await preserveTask.save();

        // Complete job
        const { transitionResizeMigrationJob } = await import("@/modules/resize-migration/services/job.service");
        await transitionResizeMigrationJob(userId, jobId, "completed");

    } catch (err: any) {
        console.error(`[Cutover Task Failure] Job ${jobId}:`, err);
        
        let activeTask = awaitTask;
        if (awaitTask.status === "succeeded") {
            activeTask = preserveTask;
        }

        const stepKey = activeTask.key === "await_cutover" ? "cutover" : "preserve_source";
        await matchAndEnrichTaskError("aws", stepKey, err, activeTask);

        await addLog(activeTask, "error", `Cutover execution failed: ${activeTask.errorMessage}`);
        activeTask.status = "failed";
        activeTask.completedAt = new Date();
        await activeTask.save();

        const { transitionResizeMigrationJob } = await import("@/modules/resize-migration/services/job.service");
        await transitionResizeMigrationJob(userId, jobId, "failed");
    }
}
