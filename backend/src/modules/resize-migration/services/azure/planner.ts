import { getCredentials } from "../../../../store/workspace-credentials";
import { getAzureAccessToken } from "../../../../providers/azure/client-factory";
import { getResources } from "../../../../services/azure/resources.service";
import axios from "axios";

export interface AzureVMSizeDetails {
    instanceType: string;
    vCpu: number;
    memoryGb: number;
    architecture: "x86_64" | "arm64";
    category: "General Purpose" | "Compute Optimized" | "Memory Optimized";
}

export const AZURE_VM_SIZES: AzureVMSizeDetails[] = [
    // General Purpose
    // Original B-series Burstable
    { instanceType: "Standard_B1ls", vCpu: 1, memoryGb: 0.5, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B1s", vCpu: 1, memoryGb: 1, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B1ms", vCpu: 1, memoryGb: 2, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B2s", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B2ms", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B4ms", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B8ms", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },

    // Bsv2-series Burstable (Intel) - New Free Tier / Burstable options
    { instanceType: "Standard_B2ts_v2", vCpu: 2, memoryGb: 1, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B2ls_v2", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B2s_v2", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B4ls_v2", vCpu: 4, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B4s_v2", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B8ls_v2", vCpu: 8, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B8s_v2", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B16ls_v2", vCpu: 16, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B16s_v2", vCpu: 16, memoryGb: 64, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B32ls_v2", vCpu: 32, memoryGb: 64, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B32s_v2", vCpu: 32, memoryGb: 128, architecture: "x86_64", category: "General Purpose" },

    // Basv2-series Burstable (AMD) - New Free Tier / Burstable options
    { instanceType: "Standard_B1as_v2", vCpu: 1, memoryGb: 1, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B2ats_v2", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B2as_v2", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B4as_v2", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B8as_v2", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B16as_v2", vCpu: 16, memoryGb: 64, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_B32as_v2", vCpu: 32, memoryGb: 128, architecture: "x86_64", category: "General Purpose" },

    { instanceType: "Standard_D2s_v3", vCpu: 2, memoryGb: 8, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_D4s_v3", vCpu: 4, memoryGb: 16, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_D8s_v3", vCpu: 8, memoryGb: 32, architecture: "x86_64", category: "General Purpose" },
    { instanceType: "Standard_D16s_v3", vCpu: 16, memoryGb: 64, architecture: "x86_64", category: "General Purpose" },
    
    // Compute Optimized
    { instanceType: "Standard_F2s_v2", vCpu: 2, memoryGb: 4, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "Standard_F4s_v2", vCpu: 4, memoryGb: 8, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "Standard_F8s_v2", vCpu: 8, memoryGb: 16, architecture: "x86_64", category: "Compute Optimized" },
    { instanceType: "Standard_F16s_v2", vCpu: 16, memoryGb: 32, architecture: "x86_64", category: "Compute Optimized" },

    // Memory Optimized
    { instanceType: "Standard_E2s_v3", vCpu: 2, memoryGb: 16, architecture: "x86_64", category: "Memory Optimized" },
    { instanceType: "Standard_E4s_v3", vCpu: 4, memoryGb: 32, architecture: "x86_64", category: "Memory Optimized" },
    { instanceType: "Standard_E8s_v3", vCpu: 8, memoryGb: 64, architecture: "x86_64", category: "Memory Optimized" },
    { instanceType: "Standard_E16s_v3", vCpu: 16, memoryGb: 128, architecture: "x86_64", category: "Memory Optimized" },

    // ARM64 General Purpose
    // Bpsv2-series Burstable (Arm) - New Free Tier / Burstable options
    { instanceType: "Standard_B2pts_v2", vCpu: 2, memoryGb: 1, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_B2pls_v2", vCpu: 2, memoryGb: 4, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_B2ps_v2", vCpu: 2, memoryGb: 8, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_B4pls_v2", vCpu: 4, memoryGb: 8, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_B4ps_v2", vCpu: 4, memoryGb: 16, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_B8pls_v2", vCpu: 8, memoryGb: 16, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_B8ps_v2", vCpu: 8, memoryGb: 32, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_B16pls_v2", vCpu: 16, memoryGb: 32, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_B16ps_v2", vCpu: 16, memoryGb: 64, architecture: "arm64", category: "General Purpose" },

    { instanceType: "Standard_D2p_v5", vCpu: 2, memoryGb: 8, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_D4p_v5", vCpu: 4, memoryGb: 16, architecture: "arm64", category: "General Purpose" },
    { instanceType: "Standard_D8p_v5", vCpu: 8, memoryGb: 32, architecture: "arm64", category: "General Purpose" }
];

export async function callAzureAPI(
    creds: { tenantId?: string; clientId?: string; clientSecret?: string },
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    data?: any,
    apiVersion?: string
): Promise<any> {
    if (!creds.tenantId || !creds.clientId || !creds.clientSecret) {
        throw new Error("Azure credentials are required and must be fully configured.");
    }
    const token = await getAzureAccessToken(creds.tenantId, creds.clientId, creds.clientSecret);
    const cleanPath = path.startsWith("http") ? path : `https://management.azure.com${path}`;
    const separator = cleanPath.includes("?") ? "&" : "?";
    const url = apiVersion ? `${cleanPath}${separator}api-version=${apiVersion}` : cleanPath;

    const config: any = {
        method,
        url,
        headers: {
            Authorization: `Bearer ${token}`,
        },
        timeout: 45000,
    };

    if (method !== "GET" && method !== "DELETE") {
        config.data = data;
        config.headers["Content-Type"] = "application/json";
    }

    try {
        const response = await axios(config);
        return response.data;
    } catch (err: any) {
        console.error(`[Azure API Error] ${method} ${path}:`, err.response?.data || err.message);
        const errMessage = err.response?.data?.error?.message || err.message;
        const errCode = err.response?.data?.error?.code || "AzureAPIError";
        throw { message: errMessage, code: errCode };
    }
}

export async function listAzureSourceServers(userId: string, region?: string): Promise<any[]> {
    const creds = await getCredentials(userId, "azure");
    if (!creds || !creds.tenantId || !creds.subscriptionId || !creds.clientId || !creds.clientSecret) {
        throw new Error("AZURE_NOT_CONNECTED");
    }

    const targetRegion = region || "all";
    const inventory = await getResources(
        userId,
        targetRegion,
        creds.tenantId,
        creds.subscriptionId,
        creds.clientId,
        creds.clientSecret
    );
    return inventory.ec2 || [];
}

export async function getAzureSourceServerDetails(
    userId: string,
    region: string,
    vmId: string
): Promise<any> {
    if (!vmId || !vmId.startsWith("/")) {
        throw new Error("Invalid Azure virtual machine resource ID format.");
    }

    const creds = await getCredentials(userId, "azure");
    if (!creds || !creds.tenantId || !creds.subscriptionId || !creds.clientId || !creds.clientSecret) {
        throw new Error("AZURE_NOT_CONNECTED");
    }

    // Parse RG & VM Name from full path ID
    const rgMatch = vmId.match(/\/resourceGroups\/([^/]+)\//i);
    const vmMatch = vmId.match(/\/virtualMachines\/([^/]+)/i);
    const resourceGroup = rgMatch?.[1] || "";
    const vmName = vmMatch?.[1] || "";

    const vm = await callAzureAPI(creds, "GET", vmId, null, "2023-09-01");
    const vmInstance = await callAzureAPI(creds, "GET", `${vmId}/instanceView`, null, "2023-09-01");

    const statuses = vmInstance.statuses || [];
    const powerStateStatus = statuses.find((s: any) => s.code?.startsWith("PowerState/"));
    const state = powerStateStatus?.code === "PowerState/running" ? "running" : "stopped";

    // Subnet and IP info from NIC
    let subnetId = "";
    let privateIp = "";
    let publicIp = "";
    let publicIpId = "";
    let nsgId = "";
    const nicId = vm.properties?.networkProfile?.networkInterfaces?.[0]?.id;

    if (nicId) {
        try {
            const nic = await callAzureAPI(creds, "GET", nicId, null, "2023-11-01");
            const ipConfig = nic.properties?.ipConfigurations?.[0];
            subnetId = ipConfig?.properties?.subnet?.id || "";
            privateIp = ipConfig?.properties?.privateIPAddress || "";
            publicIpId = ipConfig?.properties?.publicIPAddress?.id || "";
            nsgId = nic.properties?.networkSecurityGroup?.id || "";

            if (publicIpId) {
                const pip = await callAzureAPI(creds, "GET", publicIpId, null, "2023-11-01");
                publicIp = pip.properties?.ipAddress || "";
            }
        } catch (err) {
            console.warn(`[azure-resize-migration.service] Failed to get NIC details for ${nicId}:`, err);
        }
    }

    // OS Disk properties
    let osDiskSizeGb = 30;
    let osDiskType = "Standard_LRS";
    let osDiskId = vm.properties?.storageProfile?.osDisk?.managedDisk?.id;
    if (osDiskId) {
        try {
            const diskDetails = await callAzureAPI(creds, "GET", osDiskId, null, "2023-04-02");
            osDiskSizeGb = diskDetails.properties?.diskSizeGB || osDiskSizeGb;
            osDiskType = diskDetails.sku?.name || osDiskType;
        } catch (err) {
            console.warn(`[azure-resize-migration.service] Failed to get Disk details for ${osDiskId}:`, err);
        }
    }

    const tags = vm.tags || {};
    const name = vm.name || vmName;
    const adminUsername = vm.properties?.osProfile?.adminUsername || "";

    return {
        id: vmId,
        name,
        type: vm.properties?.hardwareProfile?.vmSize || "Standard_B2s",
        state,
        region: vm.location,
        resourceGroup,
        vpcId: subnetId.split("/virtualNetworks/")[0] + "/virtualNetworks/" + (subnetId.split("/virtualNetworks/")[1]?.split("/")[0] || ""),
        subnetId,
        privateIp,
        publicIp,
        elasticIp: publicIp, // Map publicIp to elasticIp to reuse frontend details card logic
        publicIpId,
        networkInterfaceId: nicId,
        networkSecurityGroupId: nsgId,
        blockDeviceMappings: [
            {
                deviceName: "OSDisk",
                volumeId: osDiskId,
                sizeGb: osDiskSizeGb,
                volumeType: osDiskType,
                status: "attached",
            }
        ],
        tags,
        architecture: AZURE_VM_SIZES.find(s => s.instanceType.toLowerCase() === (vm.properties?.hardwareProfile?.vmSize || "").toLowerCase())?.architecture || (vm.properties?.hardwareProfile?.vmSize?.toLowerCase().includes("p_v5") ? "arm64" : "x86_64"),
        launchTime: vm.properties?.timeCreated || new Date(),
        imageId: vm.properties?.storageProfile?.imageReference?.id || "customDisk",
        osType: vm.properties?.storageProfile?.osDisk?.osType || "Linux",
        adminUsername,
        suggestedSshUsername: adminUsername || ""
    };
}

export async function getAzureTargetInstanceTypes(
    userId: string,
    region: string,
    vmId: string
): Promise<AzureVMSizeDetails[]> {
    const creds = await getCredentials(userId, "azure");
    if (!creds || !creds.tenantId || !creds.subscriptionId || !creds.clientId || !creds.clientSecret) {
        throw new Error("AZURE_NOT_CONNECTED");
    }

    let arch: "x86_64" | "arm64" = "x86_64";
    try {
        const sourceDetails = await getAzureSourceServerDetails(userId, region, vmId);
        arch = sourceDetails.architecture === "arm64" ? "arm64" : "x86_64";
    } catch (err) {
        console.warn(`[azure-resize-migration.service] Failed to query source VM details for ${vmId}:`, err);
        if (vmId.toLowerCase().includes("p_v5") || vmId.toLowerCase().includes("ps_v2")) {
            arch = "arm64";
        }
    }

    const filteredOptions = AZURE_VM_SIZES.filter(t => t.architecture === arch);

    try {
        const path = `/subscriptions/${creds.subscriptionId}/providers/Microsoft.Compute/locations/${region}/vmSizes`;
        const sizeOfferings = await callAzureAPI(creds, "GET", path, null, "2023-09-01");
        const availableNames = new Set(sizeOfferings.value?.map((v: any) => v.name?.toLowerCase()) || []);

        if (availableNames.size > 0) {
            return filteredOptions.filter(opt => availableNames.has(opt.instanceType.toLowerCase()));
        }
    } catch (err) {
        console.warn(`[azure-resize-migration.service] Failed to query VM sizes in region ${region}:`, err);
    }

    return filteredOptions;
}
