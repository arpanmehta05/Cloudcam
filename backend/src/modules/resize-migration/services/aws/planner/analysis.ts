import {
    EC2Client,
    CreateImageCommand,
    RunInstancesCommand,
    CreateTagsCommand,
    AssociateAddressCommand,
    DescribeSecurityGroupsCommand
} from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import {
    ElasticLoadBalancingV2Client,
    DescribeTargetGroupsCommand,
    DescribeTargetHealthCommand
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { getCredentials } from "@/store/workspace-credentials";
import { getClientConfig } from "@/providers/aws/client-factory";
import { getAwsSourceServerDetails } from "../discovery.service";
import { ResizeMigrationAccessMode } from "../../../../../types/resize-migration.types";

export function determineAccessMode(job: any): { mode: ResizeMigrationAccessMode; warnings: string[] } {
    const warnings: string[] = [];
    const mode = job.accessMode || "cloud_only";

    if (mode === "deep_inspection") {
        const method = job.accessConfig?.method;
        if (!method) {
            warnings.push("Deep inspection mode is configured, but no access method is specified. Defaulting to cloud-only mode.");
            return { mode: "cloud_only", warnings };
        }
        if (method === "ssh") {
            if (!job.accessConfig?.privateKey) {
                warnings.push("Deep inspection via SSH is configured, but the SSH private key is missing. Defaulting to cloud-only mode.");
                return { mode: "cloud_only", warnings };
            }
        }
        return { mode: "deep_inspection", warnings };
    }

    return { mode: "cloud_only", warnings };
}

export async function verifyAwsIamPermissions(
    userId: string,
    region: string,
    creds: any,
    sourceServerId: string,
    targetServerType: string,
    cutoverMode: string,
    sourceDetails: any,
    addLog: (level: "info" | "warning" | "error", message: string) => Promise<void>
): Promise<void> {
    await addLog("info", "Verifying AWS IAM role permissions using Dry-Run queries...");
    const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
    const client = new EC2Client(cfg);

    // check: CreateImage
    await addLog("info", "Checking permission: ec2:CreateImage...");
    try {
        await client.send(new CreateImageCommand({
            InstanceId: sourceServerId,
            Name: "rabbittwatch-dryrun-preflight",
            DryRun: true
        }));
    } catch (err: any) {
        if (err.name === "UnauthorizedOperation") {
            throw {
                code: "IAM_PERMISSION_CREATE_IMAGE_DENIED",
                message: "Assumed IAM role does not have permission for ec2:CreateImage.",
                fix: "Update your AWS IAM Role policy to grant the ec2:CreateImage permission."
            };
        } else if (err.name !== "DryRunOperation") {
            await addLog("warning", `ec2:CreateImage DryRun returned unexpected error: ${err.message}. Assuming permission exists.`);
        }
    }
    await addLog("info", "Permission ec2:CreateImage verified.");

    // check: RunInstances
    await addLog("info", "Checking permission: ec2:RunInstances...");
    try {
        await client.send(new RunInstancesCommand({
            ImageId: sourceDetails.imageId || "ami-0c55b159cbfafe1f0", // dummy fallback AMI if imageId not returned
            InstanceType: targetServerType as any,
            MinCount: 1,
            MaxCount: 1,
            DryRun: true
        }));
    } catch (err: any) {
        if (err.name === "UnauthorizedOperation") {
            throw {
                code: "IAM_PERMISSION_RUN_INSTANCES_DENIED",
                message: "Assumed IAM role does not have permission for ec2:RunInstances.",
                fix: "Update your AWS IAM Role policy to grant the ec2:RunInstances permission."
            };
        } else if (err.name !== "DryRunOperation") {
            await addLog("warning", `ec2:RunInstances DryRun returned unexpected error: ${err.message}. Assuming permission exists.`);
        }
    }
    await addLog("info", "Permission ec2:RunInstances verified.");

    // check: CreateTags
    await addLog("info", "Checking permission: ec2:CreateTags...");
    try {
        await client.send(new CreateTagsCommand({
            Resources: [sourceServerId],
            Tags: [{ Key: "rabbittwatch-dryrun", Value: "preflight" }],
            DryRun: true
        }));
    } catch (err: any) {
        if (err.name === "UnauthorizedOperation") {
            throw {
                code: "IAM_PERMISSION_CREATE_TAGS_DENIED",
                message: "Assumed IAM role does not have permission for ec2:CreateTags.",
                fix: "Update your AWS IAM Role policy to grant the ec2:CreateTags permission."
            };
        } else if (err.name !== "DryRunOperation") {
            await addLog("warning", `ec2:CreateTags DryRun returned unexpected error: ${err.message}. Assuming permission exists.`);
        }
    }
    await addLog("info", "Permission ec2:CreateTags verified.");

    // check: AssociateAddress (only if elastic_ip cutover selected)
    if (cutoverMode === "elastic_ip") {
        await addLog("info", "Checking permission: ec2:AssociateAddress...");
        try {
            await client.send(new AssociateAddressCommand({
                InstanceId: sourceServerId,
                PublicIp: "8.8.8.8", // dummy public IP for dry-run
                DryRun: true
            }));
        } catch (err: any) {
            if (err.name === "UnauthorizedOperation") {
                throw {
                    code: "IAM_PERMISSION_ASSOCIATE_ADDRESS_DENIED",
                    message: "Assumed IAM role does not have permission for ec2:AssociateAddress.",
                    fix: "Update your AWS IAM Role policy to grant the ec2:AssociateAddress permission or choose a different cutover mode."
                };
            } else if (err.name !== "DryRunOperation") {
                await addLog("warning", `ec2:AssociateAddress DryRun returned unexpected error: ${err.message}. Assuming permission exists.`);
            }
        }
        await addLog("info", "Permission ec2:AssociateAddress verified.");
    }
}

export async function classifyAwsServerWorkload(
    userId: string,
    region: string,
    instanceId: string,
    vpcId?: string,
    tags?: Record<string, string>
): Promise<{
    classification: "Self-contained server" | "Partially external server" | "Custom full-system server" | "Unknown";
    confidence: "High" | "Medium" | "Low";
    signals: string[];
}> {
    const signals: string[] = [];
    const creds = await getCredentials(userId, "aws");
    if (!creds || !creds.roleArn || !creds.externalId) {
        return { classification: "Unknown", confidence: "Low", signals: ["Credentials missing for classification"] };
    }

    const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
    const ec2Client = new EC2Client(cfg);

    let hasDbTag = false;
    let hasWebTag = false;

    // 1. Analyze Tags & Naming
    if (tags) {
        const name = tags["Name"]?.toLowerCase() || "";
        const tagKeysAndValues = Object.entries(tags).map(([k, v]) => `${k}:${v}`.toLowerCase()).join(" ");

        const dbKeywords = ["db", "database", "postgres", "mysql", "mongo", "redis", "cassandra", "oracle", "sql"];
        const webKeywords = ["web", "nginx", "apache", "frontend", "app", "api", "service", "docker", "compose"];

        if (dbKeywords.some(kw => name.includes(kw) || tagKeysAndValues.includes(kw))) {
            hasDbTag = true;
            signals.push("Database-related keywords detected in server tags/name.");
        }
        if (webKeywords.some(kw => name.includes(kw) || tagKeysAndValues.includes(kw))) {
            hasWebTag = true;
            signals.push("Web/application-related keywords detected in server tags/name.");
        }
    }

    // 2. Fetch Security Groups and Open Ports
    let openPorts = new Set<number>();
    try {
        const details = await getAwsSourceServerDetails(userId, region, instanceId);
        const groupIds = details.securityGroups?.map((sg: any) => sg.groupId).filter(Boolean) || [];

        if (groupIds.length > 0) {
            const sgRes = await ec2Client.send(new DescribeSecurityGroupsCommand({ GroupIds: groupIds }));
            sgRes.SecurityGroups?.forEach(sg => {
                sg.IpPermissions?.forEach(perm => {
                    const fromPort = perm.FromPort;
                    const toPort = perm.ToPort;
                    if (fromPort !== undefined && toPort !== undefined) {
                        for (let p = fromPort; p <= toPort; p++) {
                            openPorts.add(p);
                        }
                    }
                });
            });
        }
    } catch (err) {
        console.warn("[Classification] Failed to fetch security groups:", err);
    }

    const dbPorts = [3306, 5432, 27017, 6379, 1521, 1433];
    const webPorts = [80, 443, 8080, 3000, 5000, 8000];

    const openDbPorts = dbPorts.filter(p => openPorts.has(p));
    const openWebPorts = webPorts.filter(p => openPorts.has(p));

    if (openDbPorts.length > 0) {
        signals.push(`Open database port(s) detected in security group: ${openDbPorts.join(", ")}.`);
    }
    if (openWebPorts.length > 0) {
        signals.push(`Open web/app port(s) detected in security group: ${openWebPorts.join(", ")}.`);
    }
    if (openPorts.has(22)) {
        signals.push("SSH port (22) is open.");
    }

    // 3. Check attached disks
    try {
        const details = await getAwsSourceServerDetails(userId, region, instanceId);
        const diskCount = details.blockDeviceMappings?.length || 0;
        if (diskCount > 1) {
            signals.push(`Multiple block storage volumes attached (${diskCount} disks).`);
        }
    } catch (err) {}

    // 4. Check RDS nearby in same VPC
    let rdsNearby = false;
    if (vpcId) {
        try {
            const rdsClient = new RDSClient(cfg);
            const rdsRes = await rdsClient.send(new DescribeDBInstancesCommand({}));
            const nearbyDbs = rdsRes.DBInstances?.filter(db => db.DBSubnetGroup?.VpcId === vpcId) || [];
            if (nearbyDbs.length > 0) {
                rdsNearby = true;
                signals.push(`Nearby RDS instance(s) detected in the same VPC (${vpcId}).`);
            }
        } catch (err) {
            // fail silently, RDS permissions might be missing
        }
    }

    // 5. Check Target Group / Load Balancer attachment
    let isBehindLb = false;
    try {
        const elbClient = new ElasticLoadBalancingV2Client(cfg);
        const tgRes = await elbClient.send(new DescribeTargetGroupsCommand({}));
        const targetGroups = tgRes.TargetGroups || [];
        for (const tg of targetGroups) {
            if (tg.TargetGroupArn) {
                const healthRes = await elbClient.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
                const isTarget = healthRes.TargetHealthDescriptions?.some(desc => desc.Target?.Id === instanceId);
                if (isTarget) {
                    isBehindLb = true;
                    signals.push(`Server is registered behind Load Balancer Target Group: ${tg.TargetGroupName}.`);
                    break;
                }
            }
        }
    } catch (err) {
        // fail silently, ELB permissions might be missing
    }

    // Logic: Decide Classification
    let classification: "Self-contained server" | "Partially external server" | "Custom full-system server" | "Unknown" = "Unknown";
    let confidence: "High" | "Medium" | "Low" = "Low";

    if (rdsNearby || (hasWebTag && hasDbTag === false && openDbPorts.length === 0 && openWebPorts.length > 0)) {
        // App is web server, DB is external RDS
        classification = "Partially external server";
        confidence = "Medium";
        if (rdsNearby && isBehindLb) confidence = "High";
    } else if (openDbPorts.length > 0 && openWebPorts.length > 0) {
        // App and DB are on the same machine
        classification = "Custom full-system server";
        confidence = "Medium";
    } else if (openWebPorts.length > 0 && openDbPorts.length === 0) {
        // Just app server, maybe self-contained or external DB not in same VPC
        classification = "Self-contained server";
        confidence = "Medium";
    } else if (hasDbTag || openDbPorts.length > 0) {
        // App is a standalone database server
        classification = "Custom full-system server";
        confidence = "Medium";
    }

    if (signals.length > 2) {
        if (confidence === "Medium") confidence = "High";
        else if (confidence === "Low") confidence = "Medium";
    }

    return {
        classification,
        confidence,
        signals
    };
}
