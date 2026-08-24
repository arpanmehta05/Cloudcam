import {
    EC2Client,
    DescribeInstancesCommand,
    DescribeAddressesCommand,
    DescribeVolumesCommand,
    DescribeInstanceTypeOfferingsCommand,
    CreateImageCommand,
    RunInstancesCommand,
    CreateTagsCommand,
    AssociateAddressCommand,
    DescribeSecurityGroupsCommand,
    DescribeImagesCommand,
    DescribeInstanceStatusCommand,
    StopInstancesCommand,
    StartInstancesCommand,
    DescribeInstanceAttributeCommand
} from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import {
    ElasticLoadBalancingV2Client,
    DescribeTargetGroupsCommand,
    DescribeTargetHealthCommand
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { getCredentials } from "../../../../store/workspace-credentials";
import { getResources } from "../../../../services/aws/resources.service";
import { getClientConfig } from "../../../../providers/aws/client-factory";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../../models/resize-migration.model";
import { ResizeMigrationAccessMode } from "../../../../types/resize-migration.types";
import { matchAndEnrichTaskError } from "../error-kb.service";

export interface AWSInstanceTypeDetails {
    instanceType: string;
    vCpu: number;
    memoryGb: number;
    architecture: "x86_64" | "arm64";
    category: "General Purpose" | "Compute Optimized" | "Memory Optimized";
}

export const AWS_INSTANCE_TYPES: AWSInstanceTypeDetails[] = [
    // --- x86_64 ---
    // General Purpose
    // T2 Burstable family (Intel) - Free tier / low cost
    { instanceType: "t2.nano", vCpu: 1, memoryGb: 0.5, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t2.micro", vCpu: 1, memoryGb: 1, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t2.small", vCpu: 1, memoryGb: 2, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t2.medium", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t2.large", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t2.xlarge", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t2.2xlarge", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },

    // T3a Burstable family (AMD) - Low cost
    { instanceType: "t3a.nano", vCpu: 2, memoryGb: 0.5, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3a.micro", vCpu: 2, memoryGb: 1, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3a.small", vCpu: 2, memoryGb: 2, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3a.medium", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3a.large", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3a.xlarge", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3a.2xlarge", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },

    { instanceType: "t3.nano", vCpu: 2, memoryGb: 0.5, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3.micro", vCpu: 2, memoryGb: 1, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3.small", vCpu: 2, memoryGb: 2, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3.medium", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3.large", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3.xlarge", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "t3.2xlarge", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "m5.large", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "m5.xlarge", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "m5.2xlarge", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "m6i.large", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "m6i.xlarge", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "m6i.2xlarge", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },
    // Compute Optimized
    { instanceType: "c5.large", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "c5.xlarge", vCpu: 4, memoryGb: 8, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "c5.2xlarge", vCpu: 8, memoryGb: 16, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "c6i.large", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "c6i.xlarge", vCpu: 4, memoryGb: 8, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "c6i.2xlarge", vCpu: 8, memoryGb: 16, architecture: "x86_64", category: "Compute Optimized" },
    // Memory Optimized
    { instanceType: "r5.large", vCpu: 2, memoryGb: 16, architecture: "x86_64", category: "Memory Optimized" },
    { instanceType: "r5.xlarge", vCpu: 4, memoryGb: 32, architecture: "x86_64", category: "Memory Optimized" },
    { instanceType: "r5.2xlarge", vCpu: 8, memoryGb: 64, architecture: "x86_64", category: "Memory Optimized" },
    { instanceType: "r6i.large", vCpu: 2, memoryGb: 16, architecture: "x86_64", category: "Memory Optimized" },
    { instanceType: "r6i.xlarge", vCpu: 4, memoryGb: 32, architecture: "x86_64", category: "Memory Optimized" },
    { instanceType: "r6i.2xlarge", vCpu: 8, memoryGb: 64, architecture: "x86_64", category: "Memory Optimized" },

    // --- arm64 ---
    // General Purpose
    { instanceType: "t4g.nano", vCpu: 2, memoryGb: 0.5, architecture: "arm64", category: "General Purpose" },
    { instanceType: "t4g.micro", vCpu: 2, memoryGb: 1, architecture: "arm64", category: "General Purpose" },
    { instanceType: "t4g.small", vCpu: 2, memoryGb: 2, architecture: "arm64", category: "General Purpose" },
    { instanceType: "t4g.medium", vCpu: 2, memoryGb: 4, architecture: "arm64", category: "General Purpose" },
    { instanceType: "t4g.large", vCpu: 2, memoryGb: 8, architecture: "arm64", category: "General Purpose" },
    { instanceType: "t4g.xlarge", vCpu: 4, memoryGb: 16, architecture: "arm64", category: "General Purpose" },
    { instanceType: "t4g.2xlarge", vCpu: 8, memoryGb: 32, architecture: "arm64", category: "General Purpose" },
    { instanceType: "m6g.large", vCpu: 2, memoryGb: 8, architecture: "arm64", category: "General Purpose" },
    { instanceType: "m6g.xlarge", vCpu: 4, memoryGb: 16, architecture: "arm64", category: "General Purpose" },
    { instanceType: "m6g.2xlarge", vCpu: 8, memoryGb: 32, architecture: "arm64", category: "General Purpose" },
    // Compute Optimized
    { instanceType: "c6g.large", vCpu: 2, memoryGb: 4, architecture: "arm64", category: "Compute Optimized" },
    { instanceType: "c6g.xlarge", vCpu: 4, memoryGb: 8, architecture: "arm64", category: "Compute Optimized" },
    { instanceType: "c6g.2xlarge", vCpu: 8, memoryGb: 16, architecture: "arm64", category: "Compute Optimized" },
    // Memory Optimized
    { instanceType: "r6g.large", vCpu: 2, memoryGb: 16, architecture: "arm64", category: "Memory Optimized" },
    { instanceType: "r6g.xlarge", vCpu: 4, memoryGb: 32, architecture: "arm64", category: "Memory Optimized" },
    { instanceType: "r6g.2xlarge", vCpu: 8, memoryGb: 64, architecture: "arm64", category: "Memory Optimized" }
];

function inferAwsLinuxUsername(source: {
    platformDetails?: string;
    imageName?: string;
    imageDescription?: string;
}): string | undefined {
    const haystack = [
        source.platformDetails,
        source.imageName,
        source.imageDescription
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (!haystack) return undefined;
    if (haystack.includes("ubuntu")) return "ubuntu";
    if (haystack.includes("debian")) return "admin";
    if (haystack.includes("bitnami")) return "bitnami";
    if (
        haystack.includes("amazon linux")
        || haystack.includes("amzn")
        || haystack.includes("centos")
        || haystack.includes("red hat")
        || haystack.includes("fedora")
        || haystack.includes("rocky")
        || haystack.includes("alma")
        || haystack.includes("suse")
    ) {
        return "ec2-user";
    }

    return undefined;
}

export async function listAwsSourceServers(
    userId: string,
    region?: string
): Promise<any[]> {
    const creds = await getCredentials(userId, "aws");
    if (!creds || !creds.roleArn || !creds.externalId) {
        throw new Error("AWS_NOT_CONNECTED");
    }

    const targetRegion = region || "all";
    const inventory = await getResources(userId, targetRegion, creds.roleArn, creds.externalId);
    return inventory.ec2 || [];
}

export async function getAwsSourceServerDetails(
    userId: string,
    region: string,
    instanceId: string
): Promise<any> {
    const creds = await getCredentials(userId, "aws");
    if (!creds || !creds.roleArn || !creds.externalId) {
        throw new Error("AWS_NOT_CONNECTED");
    }

    const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
    const client = new EC2Client(cfg);

    const res = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
    const reservation = res.Reservations?.[0];
    const instance = reservation?.Instances?.[0];

    if (!instance) {
        throw new Error(`AWS EC2 instance ${instanceId} not found in region ${region}.`);
    }

    let sourceImageDetails: any | undefined;
    if (instance.ImageId) {
        try {
            const imageRes = await client.send(new DescribeImagesCommand({ ImageIds: [instance.ImageId] }));
            sourceImageDetails = imageRes.Images?.[0];
        } catch (err) {
            console.warn(`[aws-resize-migration.service] Failed to describe image ${instance.ImageId} for instance ${instanceId}:`, err);
        }
    }

    let sourceUserData: string | undefined;
    try {
        const userDataRes = await client.send(new DescribeInstanceAttributeCommand({
            InstanceId: instanceId,
            Attribute: "userData"
        }));
        if (userDataRes.UserData?.Value) {
            sourceUserData = userDataRes.UserData.Value;
        }
    } catch (err) {
        console.warn(`[aws-resize-migration.service] Failed to describe user data for instance ${instanceId}:`, err);
    }

    const suggestedSshUsername = inferAwsLinuxUsername({
        platformDetails: sourceImageDetails?.PlatformDetails,
        imageName: sourceImageDetails?.Name,
        imageDescription: sourceImageDetails?.Description
    });

    // Resolve Elastic IP if present
    let elasticIp: string | undefined;
    try {
        const addrRes = await client.send(new DescribeAddressesCommand({
            Filters: [{ Name: "instance-id", Values: [instanceId] }]
        }));
        if (addrRes.Addresses && addrRes.Addresses.length > 0) {
            elasticIp = addrRes.Addresses[0].PublicIp;
        }
    } catch (err) {
        console.warn(`[aws-resize-migration.service] Failed to describe addresses for instance ${instanceId}:`, err);
    }

    // Resolve EBS Volume Details (Sizes, Types)
    const volumeIds = instance.BlockDeviceMappings?.map(bdm => bdm.Ebs?.VolumeId).filter((id): id is string => Boolean(id)) || [];
    const volumeDetailsMap = new Map<string, { sizeGb?: number; volumeType?: string }>();
    if (volumeIds.length > 0) {
        try {
            const volRes = await client.send(new DescribeVolumesCommand({ VolumeIds: volumeIds }));
            volRes.Volumes?.forEach(v => {
                if (v.VolumeId) {
                    volumeDetailsMap.set(v.VolumeId, {
                        sizeGb: v.Size,
                        volumeType: v.VolumeType
                    });
                }
            });
        } catch (err) {
            console.warn(`[aws-resize-migration.service] Failed to describe volumes for instance ${instanceId}:`, err);
        }
    }

    const blockDeviceMappings = instance.BlockDeviceMappings?.map(bdm => {
        const volId = bdm.Ebs?.VolumeId;
        const details = volId ? volumeDetailsMap.get(volId) : undefined;
        return {
            deviceName: bdm.DeviceName,
            volumeId: volId,
            sizeGb: details?.sizeGb,
            volumeType: details?.volumeType,
            status: bdm.Ebs?.Status,
            attachTime: bdm.Ebs?.AttachTime,
            deleteOnTermination: bdm.Ebs?.DeleteOnTermination
        };
    }) || [];

    const tags = instance.Tags?.reduce((acc, t) => {
        if (t.Key) acc[t.Key] = t.Value || "";
        return acc;
    }, {} as Record<string, string>) || {};

    const name = tags["Name"] || instance.InstanceId || "";

    return {
        id: instance.InstanceId,
        name,
        type: instance.InstanceType,
        state: instance.State?.Name,
        region,
        vpcId: instance.VpcId,
        subnetId: instance.SubnetId,
        privateIp: instance.PrivateIpAddress,
        publicIp: instance.PublicIpAddress,
        elasticIp,
        keyName: instance.KeyName,
        iamInstanceProfile: instance.IamInstanceProfile?.Arn,
        securityGroups: instance.SecurityGroups?.map(sg => ({
            groupId: sg.GroupId,
            groupName: sg.GroupName
        })) || [],
        blockDeviceMappings,
        tags,
        architecture: instance.Architecture || "x86_64",
        launchTime: instance.LaunchTime,
        imageId: instance.ImageId,
        imageName: sourceImageDetails?.Name,
        imageDescription: sourceImageDetails?.Description,
        platformDetails: sourceImageDetails?.PlatformDetails,
        rootDeviceName: sourceImageDetails?.RootDeviceName,
        virtualizationType: sourceImageDetails?.VirtualizationType,
        suggestedSshUsername,
        userData: sourceUserData
    };
}

export async function getAwsTargetInstanceTypes(
    userId: string,
    region: string,
    instanceId: string
): Promise<AWSInstanceTypeDetails[]> {
    const creds = await getCredentials(userId, "aws");
    if (!creds || !creds.roleArn || !creds.externalId) {
        throw new Error("AWS_NOT_CONNECTED");
    }

    // 1. Get source server architecture
    const sourceDetails = await getAwsSourceServerDetails(userId, region, instanceId);
    const arch = sourceDetails.architecture === "arm64" ? "arm64" : "x86_64";

    // 2. Filter curated options by architecture
    const filteredOptions = AWS_INSTANCE_TYPES.filter(t => t.architecture === arch);

    // 3. Query actual offerings in target region to filter out unavailable ones
    const cfg = await getClientConfig(userId, region, creds.roleArn, creds.externalId);
    const client = new EC2Client(cfg);
    const offerings = new Set<string>();

    try {
        let nextToken: string | undefined;
        do {
            const offeringsRes = await client.send(new DescribeInstanceTypeOfferingsCommand({
                LocationType: "region",
                Filters: [{ Name: "location", Values: [region] }],
                NextToken: nextToken
            }));
            offeringsRes.InstanceTypeOfferings?.forEach(o => {
                if (o.InstanceType) offerings.add(o.InstanceType);
            });
            nextToken = offeringsRes.NextToken;
        } while (nextToken);
    } catch (err) {
        console.warn(`[aws-resize-migration.service] Failed to query instance type offerings in region ${region}:`, err);
    }

    // If query returned offerings, filter curated list. Otherwise, return full filtered list as fallback.
    if (offerings.size > 0) {
        return filteredOptions.filter(opt => offerings.has(opt.instanceType));
    }

    return filteredOptions;
}