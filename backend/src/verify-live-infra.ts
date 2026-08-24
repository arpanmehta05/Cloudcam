// verify-live-infra.ts — Mocks cloud APIs and tests ACR/Artifact Registry, post-deployment verification, and action/drift check pathways.

import axios from "axios";
import { verifyEcrImageExists, verifyDeployedResources } from "./services/terraform-deployment.service";
import { validateInsight as validateAzureInsight } from "./services/azure/optimization.service";
import { validateInsight as validateGcpInsight } from "./services/gcp/optimization.service";
import { DeploymentSessionModel } from "./models/deployment.model";
import { OptimizationInsight } from "./models/optimization-cache.model";

// 1. Mock Mongoose models to run without a live MongoDB connection
Object.assign(DeploymentSessionModel, {
    findByIdAndUpdate: async () => ({}) as any,
    findOneAndUpdate: async () => ({}) as any,
    updateOne: async () => ({}) as any,
    findOne: async () => ({}) as any,
});

Object.assign(OptimizationInsight, {
    findOne: async (query: any) => {
        // Return dummy insights for Azure and GCP validation tests
        if (query._id === "mock-azure-insight") {
            return {
                _id: "mock-azure-insight",
                userId: query.userId,
                resourceId: "/subscriptions/sub-123/resourceGroups/simulations/providers/Microsoft.Compute/virtualMachines/my-vm",
                type: "rightsizing",
                save: async () => {}
            };
        }
        if (query._id === "mock-gcp-insight") {
            return {
                _id: "mock-gcp-insight",
                userId: query.userId,
                resourceId: "//compute.googleapis.com/projects/my-project/zones/us-central1-a/instances/my-instance",
                type: "rightsizing",
                save: async () => {}
            };
        }
        return null;
    }
});

// 2. Mock googleapis to stub GCP JWT token and client requests
const googleapis = require("googleapis");
googleapis.google = {
    auth: {
        JWT: class {
            constructor() {}
            async getAccessToken() {
                return { token: "mocked-gcp-token" };
            }
            async request(config: any) {
                return { data: { listFindingsResults: [], state: "ACTIVE" } };
            }
        }
    },
    cloudasset: () => ({}),
    compute: () => ({
        instances: {
            get: async () => ({ data: { status: "RUNNING" } })
        },
        disks: {
            get: async () => ({ data: { status: "READY" } })
        }
    }),
    storage: () => ({}),
    sqladmin: () => ({
        instances: {
            get: async () => ({ data: { state: "RUNNABLE" } })
        }
    }),
    cloudfunctions: () => ({}),
    run: () => ({
        projects: {
            locations: {
                services: {
                    get: async () => ({ data: { status: "RUNNING" } })
                }
            }
        }
    }),
    container: () => ({
        projects: {
            locations: {
                clusters: {
                    get: async () => ({ data: { status: "RUNNING" } })
                }
            }
        }
    }),
    pubsub: () => ({}),
    cloudbilling: () => ({}),
    recommender: () => ({}),
    monitoring: () => ({}),
    logging: () => ({}),
    securitycenter: () => ({}),
    cloudresourcemanager: () => ({}),
    artifactregistry: () => ({})
};

// 3. Mock Axios to handle Azure and GCP REST endpoints
axios.post = async (url: string, data?: any, config?: any): Promise<any> => {
    if (url.includes("login.microsoftonline.com") || url.includes("/oauth2/token") || url.includes("/oauth2/exchange")) {
        return {
            status: 200,
            data: {
                access_token: "mocked-azure-token",
                refresh_token: "mocked-azure-refresh-token",
                expires_in: 3600
            }
        };
    }
    return { status: 200, data: {} };
};

axios.get = async (url: string, config?: any): Promise<any> => {
    // Azure resource verification/validation mocks
    if (url.includes("Microsoft.ApiManagement/service")) {
        return { status: 200, data: { properties: { provisioningState: "Succeeded" } } };
    }
    if (url.includes("Microsoft.DocumentDB/databaseAccounts")) {
        return { status: 200, data: { properties: { provisioningState: "Succeeded" } } };
    }
    if (url.includes("Microsoft.ContainerRegistry/registries")) {
        return { status: 200, data: { properties: { provisioningState: "Succeeded" } } };
    }
    if (url.includes("Microsoft.Compute/virtualMachines")) {
        return { status: 200, data: { properties: { provisioningState: "Succeeded" } } };
    }
    if (url.includes("Microsoft.ContainerService/managedClusters")) {
        return { status: 200, data: { properties: { provisioningState: "Succeeded" } } };
    }

    // GCP resource verification mocks
    if (url.includes("/gateways/")) {
        return { status: 200, data: { state: "ACTIVE" } };
    }
    if (url.includes("/databases/")) {
        return { status: 200, data: { state: "ACTIVE" } };
    }
    if (url.includes("/repositories/")) {
        return { status: 200, data: { state: "ACTIVE" } };
    }
    if (url.includes("/clusters/")) {
        return { status: 200, data: { status: "RUNNING" } };
    }
    if (url.includes("/services/")) {
        return { status: 200, data: { terminalCondition: { state: "RUNNING" } } };
    }

    return { status: 200, data: {} };
};

axios.head = async (url: string, config?: any): Promise<any> => {
    // Return 200 OK for Azure ACR manifest HEAD query
    if (url.includes("/manifests/")) {
        return { status: 200 };
    }
    return { status: 404 };
};

async function runTests() {
    console.log("=== STARTING INFRASTRUCTURE VERIFICATION TESTS ===");

    // Test 1: verifyEcrImageExists for Azure ACR
    console.log("\n--- Test 1: verifyEcrImageExists (Azure ACR) ---");
    const acrResult = await verifyEcrImageExists(
        "eastus", "", "", "",
        "my-registry/my-image", "latest",
        {
            provider: "azure",
            azure: {
                clientId: "mock-client",
                clientSecret: "mock-secret",
                tenantId: "mock-tenant",
                subscriptionId: "mock-sub"
            }
        }
    );
    console.log("Acr result:", acrResult);
    if (acrResult === true) {
        console.log("=> Test 1 Passed!");
    } else {
        throw new Error("Test 1 Failed: ACR image verification returned false");
    }

    // Test 2: verifyEcrImageExists for GCP Artifact Registry
    console.log("\n--- Test 2: verifyEcrImageExists (GCP Artifact Registry) ---");
    const arResult = await verifyEcrImageExists(
        "us-central1", "", "", "",
        "us-central1-docker.pkg.dev/my-project/my-repo/my-image", "latest",
        {
            provider: "gcp",
            gcp: {
                projectId: "mock-project",
                clientEmail: "mock-email",
                privateKey: "mock-key"
            }
        }
    );
    console.log("Artifact Registry result:", arResult);
    if (arResult === true) {
        console.log("=> Test 2 Passed!");
    } else {
        throw new Error("Test 2 Failed: Artifact Registry image verification returned false");
    }

    // Test 3: verifyDeployedResources (Azure Post-Deployment Validation Logs)
    console.log("\n--- Test 3: verifyDeployedResources (Azure Post-Deploy) ---");
    const azureNodes = [
        { serviceId: "apigateway", config: { serviceName: "test-apim" } },
        { serviceId: "dynamodb", config: { accountName: "test-cosmos" } },
        { serviceId: "ecr", config: { registryName: "test-acr" } },
        { serviceId: "azure_aks", config: { clusterName: "test-aks" } }
    ];
    await verifyDeployedResources(
        "test-dep-azure",
        "azure",
        azureNodes,
        {},
        {
            azure: {
                clientId: "mock-client",
                clientSecret: "mock-secret",
                tenantId: "mock-tenant",
                subscriptionId: "mock-sub"
            }
        }
    );
    console.log("=> Test 3 Passed!");

    // Test 4: verifyDeployedResources (GCP Post-Deployment Validation Logs)
    console.log("\n--- Test 4: verifyDeployedResources (GCP Post-Deploy) ---");
    const gcpNodes = [
        { serviceId: "apigateway", config: { gatewayId: "test-gateway" } },
        { serviceId: "dynamodb", config: { databaseId: "test-firestore" } },
        { serviceId: "ecr", config: { repositoryId: "test-artifact-repo" } },
        { serviceId: "gcp_gke", config: { clusterName: "test-gke" } },
        { serviceId: "gcp_cloud_run", config: { serviceName: "test-cloud-run" } }
    ];
    await verifyDeployedResources(
        "test-dep-gcp",
        "gcp",
        gcpNodes,
        {},
        {
            gcp: {
                projectId: "mock-project",
                clientEmail: "mock-email",
                privateKey: "mock-key"
            },
            region: "us-central1"
        }
    );
    console.log("=> Test 4 Passed!");

    // Test 5: Azure validateInsight drift check
    console.log("\n--- Test 5: validateInsight (Azure VM rightsizing) ---");
    const azureInsightResult = await validateAzureInsight(
        "mock-azure-insight",
        "mock-user",
        "mock-workspace",
        "mock-tenant",
        "mock-sub",
        "mock-client",
        "mock-secret"
    );
    console.log("Azure insight validation result:", azureInsightResult);
    if (azureInsightResult.valid === true) {
        console.log("=> Test 5 Passed!");
    } else {
        throw new Error(`Test 5 Failed: ${azureInsightResult.reason}`);
    }

    // Test 6: GCP validateInsight drift check
    console.log("\n--- Test 6: validateInsight (GCP VM rightsizing) ---");
    const gcpInsightResult = await validateGcpInsight(
        "mock-gcp-insight",
        "mock-user",
        "mock-workspace",
        "mock-project",
        "mock-email",
        "mock-key"
    );
    console.log("GCP insight validation result:", gcpInsightResult);
    if (gcpInsightResult.valid === true) {
        console.log("=> Test 6 Passed!");
    } else {
        throw new Error(`Test 6 Failed: ${gcpInsightResult.reason}`);
    }

    console.log("\n=== ALL INFRASTRUCTURE VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
