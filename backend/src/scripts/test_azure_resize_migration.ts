import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import { User } from "../models/user.model";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../models/resize-migration.model";
import { createResizeMigrationJob } from "../services/resize-migration/job.service";
import {
    runAzurePreflightChecks,
    runAzureSnapshotCreation,
    runAzureTargetLaunch,
    runAzureTargetValidation,
    runAzureTargetCutover,
    runAzureTargetRollback
} from "../services/resize-migration/azure-resize-migration.service";

// Load environment variables
dotenv.config();

// Custom Axios Adapter to Mock Azure Resource Manager endpoints
const configureMockAdapter = () => {
    axios.defaults.adapter = async (config: any) => {
        const url = config.url || "";
        const method = config.method?.toUpperCase() || "GET";
        let body = null;
        if (config.data) {
            if (typeof config.data === "string") {
                try {
                    body = JSON.parse(config.data);
                } catch {
                    body = config.data;
                }
            } else {
                body = config.data;
            }
        }

        console.log(`[MOCK AZURE API] ${method} -> ${url}`);

        if (url.includes("oauth2/v2.0/token")) {
            return {
                data: { access_token: "mock-azure-token", expires_in: 3600 },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }
        if (url.includes("/locations/") && url.includes("/vmSizes")) {
            return {
                data: {
                    value: [
                        { name: "Standard_B2s", numberOfCores: 2, memoryInMB: 4096 },
                        { name: "Standard_B2ms", numberOfCores: 2, memoryInMB: 8192 }
                    ]
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }
        if (url.includes("/instanceView")) {
            return {
                data: {
                    statuses: [
                        { code: "PowerState/running", displayStatus: "VM running" }
                    ]
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }
        if (url.includes("/virtualMachines/test-vm") || url.includes("/vm-target-")) {
            const isTarget = url.includes("/vm-target-");
            return {
                data: {
                    id: isTarget 
                        ? "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Compute/virtualMachines/vm-target-test"
                        : "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Compute/virtualMachines/test-vm",
                    name: isTarget ? "vm-target-test" : "test-vm",
                    location: "centralindia",
                    tags: { Database: "true" },
                    properties: {
                        hardwareProfile: { vmSize: isTarget ? "Standard_B2ms" : "Standard_B2s" },
                        storageProfile: {
                            osDisk: {
                                name: "test-os-disk",
                                managedDisk: { id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Compute/disks/test-disk" },
                                osType: "Linux"
                            },
                            imageReference: { id: "mock-image-id" }
                        },
                        networkProfile: {
                            networkInterfaces: [
                                { id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Network/networkInterfaces/test-nic" }
                            ]
                        },
                        timeCreated: "2026-01-01T00:00:00Z",
                        provisioningState: "Succeeded"
                    }
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }
        if (url.includes("/networkInterfaces/")) {
            return {
                data: {
                    id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Network/networkInterfaces/test-nic",
                    properties: {
                        ipConfigurations: [
                            {
                                name: "ipconfig1",
                                properties: {
                                    subnet: { id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Network/virtualNetworks/test-vnet/subnets/test-subnet" },
                                    privateIPAllocationMethod: "Dynamic",
                                    privateIPAddress: "10.0.0.4",
                                    publicIPAddress: { id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Network/publicIPAddresses/test-pip" }
                                }
                            }
                        ],
                        provisioningState: "Succeeded"
                    }
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }
        if (url.includes("/publicIPAddresses/")) {
            return {
                data: {
                    properties: {
                        ipAddress: "52.172.1.2",
                        provisioningState: "Succeeded"
                    }
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }
        if (url.includes("/disks/")) {
            return {
                data: {
                    properties: {
                        diskSizeGB: 128,
                        provisioningState: "Succeeded"
                    },
                    sku: { name: "Premium_LRS" }
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }
        if (url.includes("/snapshots/") || url.includes("/powerOff") || url.includes("/start")) {
            return {
                data: {
                    properties: {
                        provisioningState: "Succeeded"
                    }
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }

        // Catch-all mock success
        return {
            data: { properties: { provisioningState: "Succeeded" } },
            status: 200,
            statusText: "OK",
            headers: {},
            config
        };
    };
};

async function testWorkflow() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittwatch");
        console.log("Connected.");

        // 1. Seed Mock Azure User
        console.log("\n--- Seeding Mock User with Azure credentials ---");
        let user = await User.findOne({ email: "azure-test@rabbittwatch.com" });
        if (!user) {
            user = await User.create({
                name: "Azure Test User",
                email: "azure-test@rabbittwatch.com",
                passwordHash: "mock-password-hash",
                azureCredentials: {
                    tenantId: "tenant-123",
                    subscriptionId: "sub-123",
                    clientId: "client-123",
                    clientSecret: "secret-123",
                    principalId: "principal-123",
                    connectedAt: new Date()
                },
                cloudConnections: [
                    {
                        provider: "azure",
                        connectionId: "sub-123",
                        credentials: {
                            tenantId: "tenant-123",
                            subscriptionId: "sub-123",
                            clientId: "client-123",
                            clientSecret: "secret-123"
                        },
                        connectedAt: new Date(),
                        enabledModules: ["core-monitoring", "cost", "security"],
                        logForwardingEnabled: false
                    }
                ]
            });
        }
        const userId = user._id.toString();

        // 2. Setup mock adapter
        configureMockAdapter();

        // 3. Create Migration Job
        console.log("\n--- Creating Azure Resize Migration Job ---");
        const vmId = "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Compute/virtualMachines/test-vm";
        const { job, tasks } = await createResizeMigrationJob(userId, {
            provider: "azure",
            region: "centralindia",
            sourceServerId: vmId,
            sourceServerName: "test-vm",
            targetServerType: "Standard_B2ms",
            mode: "clone_and_cutover",
            cutoverMode: "elastic_ip",
            metadata: {
                stopSourceAfterCutover: true
            }
        });
        console.log(`Job Created successfully. Job ID: ${job._id}, Status: ${job.status}`);
        console.log(`Tasks Created: ${tasks.length}`);

        // 4. Run Preflight Task
        console.log("\n--- Running Task: Preflight Checks ---");
        await runAzurePreflightChecks(job._id.toString(), userId);
        let updatedJob = await ResizeMigrationJobModel.findById(job._id);
        let preflightTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "preflight" });
        console.log(`Preflight status: ${preflightTask?.status}`);
        console.log(`Job status after preflight: ${updatedJob?.status}`);
        console.log(`Workload Classification: ${updatedJob?.metadata?.classification?.classification}`);

        // 5. Run Snapshot Task
        console.log("\n--- Running Task: Snapshot Copy ---");
        await runAzureSnapshotCreation(job._id.toString(), userId);
        updatedJob = await ResizeMigrationJobModel.findById(job._id);
        let snapshotTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "create_source_image" });
        console.log(`Snapshot status: ${snapshotTask?.status}`);
        console.log(`Job status after snapshot: ${updatedJob?.status}`);
        console.log(`OS Snapshot Path: ${updatedJob?.sourceSnapshotId}`);

        // 6. Run Launch Target Task
        console.log("\n--- Running Task: Launch Target VM ---");
        await runAzureTargetLaunch(job._id.toString(), userId);
        updatedJob = await ResizeMigrationJobModel.findById(job._id);
        let launchTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "launch_target" });
        console.log(`Launch status: ${launchTask?.status}`);
        console.log(`Job status after launch: ${updatedJob?.status}`);
        console.log(`Launched target VM ID: ${updatedJob?.targetServerId}`);

        // 7. Run Validation Task
        console.log("\n--- Running Task: Target Validation ---");
        await runAzureTargetValidation(job._id.toString(), userId);
        updatedJob = await ResizeMigrationJobModel.findById(job._id);
        let validationTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "validate_target" });
        console.log(`Validation status: ${validationTask?.status}`);
        console.log(`Job status after validation: ${updatedJob?.status}`);

        // 8. Run Cutover Task
        console.log("\n--- Running Task: Cutover ---");
        await runAzureTargetCutover(job._id.toString(), userId);
        updatedJob = await ResizeMigrationJobModel.findById(job._id);
        let cutoverTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "await_cutover" });
        let preserveTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "preserve_source" });
        console.log(`Cutover status: ${cutoverTask?.status}`);
        console.log(`Preserve source status: ${preserveTask?.status}`);
        console.log(`Final Job status: ${updatedJob?.status}`);

        // 9. Test Rollback
        console.log("\n--- Triggering Rollback ---");
        await runAzureTargetRollback(job._id.toString(), userId);
        updatedJob = await ResizeMigrationJobModel.findById(job._id);
        console.log(`Job status after Rollback: ${updatedJob?.status}`);

        // Cleanup database
        console.log("\nCleaning up test job & tasks...");
        await ResizeMigrationJobModel.deleteOne({ _id: job._id });
        await ResizeMigrationTaskModel.deleteMany({ jobId: job._id.toString() });
        console.log("Cleanup finished.");

    } catch (err) {
        console.error("Test execution failed:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

testWorkflow();
