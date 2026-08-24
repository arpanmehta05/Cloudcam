import { getCredentials } from "../../../../store/workspace-credentials";
import { getResources } from "../../../../services/gcp/resources.service";
import { createGcpGoogleApisClient } from "../../../../providers/gcp/client-factory";

export interface GcpVMSizeDetails {
    instanceType: string;
    vCpu: number;
    memoryGb: number;
    architecture: "x86_64" | "arm64";
    category: "General Purpose" | "Compute Optimized" | "Memory Optimized";
}

export const GCP_VM_SIZES: GcpVMSizeDetails[] = [
    // General Purpose
    { instanceType: "e2-micro", vCpu: 2, memoryGb: 1, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "e2-small", vCpu: 2, memoryGb: 2, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "e2-medium", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "e2-standard-2", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "e2-standard-4", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "e2-standard-8", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },
    
    { instanceType: "n2-standard-2", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "n2-standard-4", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },

    // Compute Optimized
    { instanceType: "c2-standard-4", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "c2-standard-8", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "Compute Optimized" },

    // Memory Optimized
    { instanceType: "m1-ultramem-40", vCpu: 40, memoryGb: 961, architecture: "x86_64", category: "Memory Optimized" },

    // ARM64 General Purpose
    { instanceType: "t2a-standard-1", vCpu: 1, memoryGb: 4, architecture: "arm64", category: "General Purpose" },
    { instanceType: "t2a-standard-2", vCpu: 2, memoryGb: 8, architecture: "arm64", category: "General Purpose" },
    { instanceType: "t2a-standard-4", vCpu: 4, memoryGb: 16, architecture: "arm64", category: "General Purpose" }
];

export async function getGcpClient(userId: string) {
    const creds = await getCredentials(userId, "gcp");
    if (!creds || !creds.projectId || !creds.clientEmail || !creds.privateKey) {
        throw {
            code: "GCP_NOT_CONNECTED",
            message: "GCP integration credentials not linked or incomplete.",
            fix: "Link your GCP account credentials on the Integrations tab."
        };
    }
    return {
        client: createGcpGoogleApisClient({
            projectId: creds.projectId,
            clientEmail: creds.clientEmail,
            privateKey: creds.privateKey
        }),
        projectId: creds.projectId
    };
}

export async function listGcpSourceServers(
    userId: string,
    region?: string
): Promise<any[]> {
    const creds = await getCredentials(userId, "gcp");
    if (!creds || !creds.projectId || !creds.clientEmail || !creds.privateKey) {
        throw new Error("GCP_NOT_CONNECTED");
    }

    const targetRegion = region || "all";
    const inventory = await getResources(
        userId,
        targetRegion,
        creds.projectId,
        creds.clientEmail,
        creds.privateKey
    );
    return inventory.ec2 || [];
}

export async function getGcpSourceServerDetails(
    userId: string,
    region: string,
    instanceId: string
): Promise<any> {
    const { client, projectId } = await getGcpClient(userId);
    const servers = await listGcpSourceServers(userId, region);
    const inst = servers.find(s => s.id === instanceId);
    if (!inst) {
        throw new Error(`GCP instance ${instanceId} not found in region ${region}.`);
    }

    const zoneName = inst.zone;
    
    // Fetch detailed instance info
    const instanceRes = await client.compute.instances.get({
        project: projectId,
        zone: zoneName,
        instance: inst.name
    });
    
    const detailedInst = instanceRes.data;

    // Resolve IP addresses
    let privateIp = "";
    let publicIp = "";
    if (detailedInst.networkInterfaces && detailedInst.networkInterfaces.length > 0) {
        const nic = detailedInst.networkInterfaces[0];
        privateIp = nic.networkIP || "";
        if (nic.accessConfigs && nic.accessConfigs.length > 0) {
            publicIp = nic.accessConfigs[0].natIP || "";
        }
    }

    // Identify the boot disk and block mappings
    const blockDeviceMappings: any[] = [];
    let imageId = "unknown";
    if (detailedInst.disks && detailedInst.disks.length > 0) {
        for (const disk of detailedInst.disks) {
            const diskName = disk.source ? disk.source.split("/").pop() : "";
            blockDeviceMappings.push({
                deviceName: disk.deviceName || "boot-disk",
                volumeId: diskName,
                sizeGb: disk.initializeParams?.diskSizeGb ? Number(disk.initializeParams.diskSizeGb) : 30,
                volumeType: disk.initializeParams?.diskType ? disk.initializeParams.diskType.split("/").pop() : "pd-standard",
                status: "attached",
                boot: disk.boot || false
            });
            if (disk.boot && disk.initializeParams?.sourceImage) {
                imageId = disk.initializeParams.sourceImage.split("/").pop() || "unknown";
            }
        }
    }

    return {
        id: inst.id,
        name: inst.name,
        type: inst.type,
        state: inst.state,
        region: inst.region,
        zone: zoneName,
        vpcId: detailedInst.networkInterfaces?.[0]?.network || "default",
        subnetId: detailedInst.networkInterfaces?.[0]?.subnetwork || "default",
        privateIp,
        publicIp,
        elasticIp: publicIp,
        blockDeviceMappings,
        tags: detailedInst.labels || {},
        architecture: "x86_64", // Default to x86_64
        launchTime: detailedInst.creationTimestamp ? new Date(detailedInst.creationTimestamp) : new Date(),
        imageId,
        suggestedSshUsername: "ubuntu"
    };
}

export async function getGcpTargetInstanceTypes(
    userId: string,
    region: string,
    instanceId: string
): Promise<GcpVMSizeDetails[]> {
    const creds = await getCredentials(userId, "gcp");
    if (!creds || !creds.projectId || !creds.clientEmail || !creds.privateKey) {
        throw new Error("GCP_NOT_CONNECTED");
    }

    return GCP_VM_SIZES;
}
