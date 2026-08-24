import { callAzureAPI } from "../planner";

export async function cleanupPreexistingResources(
    creds: any,
    rg: string,
    jobId: string,
    addLog: (level: "info" | "warning" | "error", message: string) => Promise<void>
): Promise<{ createdPip: boolean; targetPublicIp: string | null }> {
    const targetDiskName = `disk-target-${jobId.slice(-6)}`;
    const targetDiskPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Compute/disks/${targetDiskName}`;

    const targetNicName = `nic-target-${jobId.slice(-6)}`;
    const targetNicPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${targetNicName}`;

    const targetVmName = `vm-target-${jobId.slice(-6)}`;
    const targetVmPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Compute/virtualMachines/${targetVmName}`;

    const targetPipName = `pip-target-${jobId.slice(-6)}`;
    const targetPipPath = `/subscriptions/${creds.subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${targetPipName}`;

    // Cleanup pre-existing VM if it exists (VM must be deleted before disk)
    try {
        await callAzureAPI(creds, "GET", targetVmPath, null, "2023-09-01");
        await addLog("warning", `Pre-existing target VM ${targetVmName} found. Deleting it to ensure clean rebuild...`);
        await callAzureAPI(creds, "DELETE", targetVmPath, null, "2023-09-01");
        let vmDeleted = false;
        for (let d = 0; d < 12; d++) {
            await new Promise(r => setTimeout(r, 5000));
            try {
                await callAzureAPI(creds, "GET", targetVmPath, null, "2023-09-01");
            } catch (err) {
                vmDeleted = true;
                break;
            }
        }
        if (vmDeleted) {
            await addLog("info", `Pre-existing VM ${targetVmName} deleted successfully.`);
        }
    } catch (e) {
        // VM doesn't exist
    }

    // Cleanup pre-existing NIC if it exists
    try {
        await callAzureAPI(creds, "GET", targetNicPath, null, "2023-11-01");
        await addLog("warning", `Pre-existing target NIC ${targetNicName} found. Deleting it...`);
        await callAzureAPI(creds, "DELETE", targetNicPath, null, "2023-11-01");
        let nicDeleted = false;
        for (let d = 0; d < 6; d++) {
            await new Promise(r => setTimeout(r, 5000));
            try {
                await callAzureAPI(creds, "GET", targetNicPath, null, "2023-11-01");
            } catch (err) {
                nicDeleted = true;
                break;
            }
        }
        if (nicDeleted) {
            await addLog("info", `Pre-existing NIC ${targetNicName} deleted successfully.`);
        }
    } catch (e) {
        // NIC doesn't exist
    }

    // Cleanup pre-existing OS Disk if it exists
    try {
        await callAzureAPI(creds, "GET", targetDiskPath, null, "2023-04-02");
        await addLog("warning", `Pre-existing target disk ${targetDiskName} found. Deleting it to avoid conflicts...`);
        
        let diskDeleted = false;
        for (let retry = 0; retry < 12; retry++) {
            try {
                await callAzureAPI(creds, "DELETE", targetDiskPath, null, "2023-04-02");
                // Poll for deletion
                for (let d = 0; d < 6; d++) {
                    await new Promise(r => setTimeout(r, 5000));
                    try {
                        await callAzureAPI(creds, "GET", targetDiskPath, null, "2023-04-02");
                    } catch (err) {
                        diskDeleted = true;
                        break;
                    }
                }
                if (diskDeleted) break;
            } catch (delErr: any) {
                await addLog("warning", `Failed to delete disk ${targetDiskName} (attempt ${retry + 1}/12): ${delErr.message || delErr}. Waiting 5s for VM detach...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
        if (diskDeleted) {
            await addLog("info", `Pre-existing disk ${targetDiskName} deleted successfully.`);
        } else {
            throw new Error(`Could not delete pre-existing disk ${targetDiskName}. It may still be attached to a deleting VM.`);
        }
    } catch (e) {
        // Disk doesn't exist
    }

    // Cleanup pre-existing Public IP if it exists
    try {
        await callAzureAPI(creds, "GET", targetPipPath, null, "2023-11-01");
        await addLog("warning", `Pre-existing public IP ${targetPipName} found. Deleting it...`);
        await callAzureAPI(creds, "DELETE", targetPipPath, null, "2023-11-01");
        let pipDeleted = false;
        for (let d = 0; d < 6; d++) {
            await new Promise(r => setTimeout(r, 5000));
            try {
                await callAzureAPI(creds, "GET", targetPipPath, null, "2023-11-01");
            } catch (err) {
                pipDeleted = true;
                break;
            }
        }
        if (pipDeleted) {
            await addLog("info", `Pre-existing public IP ${targetPipName} deleted successfully.`);
        }
    } catch (e) {
        // Public IP doesn't exist
    }

    return { createdPip: false, targetPublicIp: null };
}
