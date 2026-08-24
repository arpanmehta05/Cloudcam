import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import path from "path";
import { User } from "../models/user.model";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../models/resize-migration.model";
import { createResizeMigrationJob, resumeResizeMigrationJob } from "../services/resize-migration/job.service";
import { runAzurePreflightChecks, runAzureTargetValidation, runAzureTargetCutover } from "../services/resize-migration/azure-resize-migration.service";
import { explainTaskFailure } from "../services/resize-migration/ai-explain.service";
import { generateMigrationReport } from "../services/resize-migration/report.service";

// Load environment variables
dotenv.config();

// Custom Axios Adapter to Mock Azure Resource Manager & DNS endpoints
const configureMockAdapter = () => {
    axios.defaults.adapter = async (config: any) => {
        const url = config.url || "";
        const method = config.method?.toUpperCase() || "GET";
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
        if (url.includes("/virtualMachines/")) {
            return {
                data: {
                    id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Compute/virtualMachines/test-vm",
                    name: "test-vm",
                    location: "centralindia",
                    properties: {
                        hardwareProfile: { vmSize: "Standard_B2ms" },
                        storageProfile: {
                            osDisk: {
                                name: "test-os-disk",
                                osType: "Linux",
                                managedDisk: { id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Compute/disks/test-disk" }
                            }
                        },
                        networkProfile: {
                            networkInterfaces: [
                                { id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Network/networkInterfaces/test-nic" }
                            ]
                        }
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
                    properties: {
                        ipConfigurations: [
                            {
                                properties: {
                                    publicIPAddress: { id: "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Network/publicIPAddresses/test-pip" }
                                }
                            }
                        ]
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
                        ipAddress: "52.172.1.2"
                    }
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config
            };
        }
        if (url.includes("/providers/Microsoft.Network/dnsZones/")) {
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

        return {
            data: { properties: { provisioningState: "Succeeded" } },
            status: 200,
            statusText: "OK",
            headers: {},
            config
        };
    };
};

async function runTest() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittwatch");
        console.log("Connected.");

        // 1. Seeding mock user
        console.log("\n--- Seeding Mock User ---");
        let user = await User.findOne({ email: "advanced-test@rabbittwatch.com" });
        if (!user) {
            user = await User.create({
                name: "Advanced Test User",
                email: "advanced-test@rabbittwatch.com",
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

        configureMockAdapter();

        // 2. Create job with Scheduled window, Deep Inspection, and DNS cutover mode
        console.log("\n--- Creating Job with Scheduling, Deep Inspection, and DNS Cutover ---");
        const vmId = "/subscriptions/sub-123/resourceGroups/rg-123/providers/Microsoft.Compute/virtualMachines/test-vm";
        
        const scheduledTime = new Date(Date.now() + 5000).toISOString(); // 5 seconds in future
        
        const { job, tasks } = await createResizeMigrationJob(userId, {
            provider: "azure",
            region: "centralindia",
            sourceServerId: vmId,
            sourceServerName: "test-vm",
            targetServerType: "Standard_B2ms",
            mode: "clone_and_cutover",
            cutoverMode: "dns",
            accessMode: "deep_inspection",
            accessConfig: {
                method: "ssh",
                username: "adminuser",
                privateKey: "fake-key",
                port: 22
            },
            metadata: {
                scheduledExecutionTime: scheduledTime,
                dnsConfig: {
                    zoneName: "rabbittwatch.dev",
                    resourceGroupName: "dns-rg",
                    domainName: "app.rabbittwatch.dev",
                    recordType: "A",
                    ttl: 300
                }
            }
        });

        console.log(`Job created successfully. ID: ${job._id}, Status: ${job.status}`);
        console.log(`Deep Inspection mode: ${job.accessMode}`);
        console.log(`Cutover mode: ${job.cutoverMode}`);
        console.log(`Scheduled Execution time: ${job.metadata?.scheduledExecutionTime}`);

        // 3. Verification of target validation deep inspection logs simulation
        console.log("\n--- Testing Target Validation Deep Inspection ---");
        // Mock target VM ID so validation runs
        job.targetServerId = vmId;
        await job.save();

        await runAzureTargetValidation(job._id.toString(), userId);
        
        const validationTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "validate_target" });
        console.log(`Validation Task status: ${validationTask?.status}`);
        console.log("Logs during validation (Deep Inspection):");
        validationTask?.logs.forEach(l => console.log(`  [${l.level.toUpperCase()}] ${l.message}`));

        // 4. Verification of DNS update cutover task
        console.log("\n--- Testing DNS Cutover record set updates ---");
        await runAzureTargetCutover(job._id.toString(), userId);
        
        const cutoverTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "await_cutover" });
        console.log(`Cutover Task status: ${cutoverTask?.status}`);
        console.log("Logs during DNS Cutover:");
        cutoverTask?.logs.forEach(l => console.log(`  [${l.level.toUpperCase()}] ${l.message}`));

        // 5. Test AI Explainer for a failed task
        console.log("\n--- Testing Gemini AI Error Diagnosis ---");
        // Mock a failed task
        const failedTask = await ResizeMigrationTaskModel.findOne({ jobId: job._id.toString(), key: "preflight" });
        if (failedTask) {
            failedTask.status = "failed";
            failedTask.errorCode = "AZURE_AUTH_FAILED";
            failedTask.errorMessage = "The provided client secret is expired or invalid for tenant-123.";
            failedTask.logs = [
                { level: "info", message: "Starting Preflight checks.", timestamp: new Date() },
                { level: "error", message: "Failed to fetch Azure authentication token: client secret expired.", timestamp: new Date() }
            ];
            await failedTask.save();

            // Set job status to failed so we can test resume
            job.status = "failed";
            await job.save();

            console.log("Requesting AI Diagnosis...");
            const explanation = await explainTaskFailure(job, failedTask);
            console.log("AI Explanation Result:");
            console.log(JSON.stringify(explanation, null, 2));
        }

        // 6. Test Job Resumption
        console.log("\n--- Testing Job Resumption ---");
        const resumeResult = await resumeResizeMigrationJob(userId, job._id.toString());
        console.log(`Job Resumed successfully. New Job Status: ${resumeResult.job.status}`);
        
        const resumedTask = resumeResult.tasks.find(t => t.key === "preflight");
        console.log(`Resumed Task Status (should be pending): ${resumedTask?.status}`);

        // 7. Test PDF Report Generation
        console.log("\n--- Testing PDF Report Generation ---");
        const allTasks = await ResizeMigrationTaskModel.find({ jobId: job._id.toString() }).sort({ order: 1 });
        const pdfBuffer = await generateMigrationReport(job, allTasks);
        console.log(`PDF Generated. Buffer size: ${pdfBuffer.length} bytes`);

        const outputPath = path.join(__dirname, "../..", "test-migration-report.pdf");
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log(`Saved PDF report to: ${outputPath}`);

        // Clean up database records
        console.log("\nCleaning up test job & tasks...");
        await ResizeMigrationJobModel.deleteOne({ _id: job._id });
        await ResizeMigrationTaskModel.deleteMany({ jobId: job._id.toString() });
        console.log("Database clean up complete.");

    } catch (err) {
        console.error("Test execution failed:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

runTest();
