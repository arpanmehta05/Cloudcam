const path = require("path");

// Resolve absolute paths for the modules we want to mock
const azureResourcesPath = path.resolve(__dirname, "./services/azure/resources.service.ts");
const azureAlertsRulesPath = path.resolve(__dirname, "./providers/azure/alerts.provider.ts");
const gcpResourcesPath = path.resolve(__dirname, "./services/gcp/resources.service.ts");
const gcpAlertRulesPath = path.resolve(__dirname, "./providers/gcp/alerts.provider.ts");

// Define custom mock exports in require.cache (casting cache access to any to bypass tsc checks)
(require.cache as any)[azureResourcesPath] = {
    id: azureResourcesPath,
    filename: azureResourcesPath,
    loaded: true,
    exports: {
        getResources: async () => ({
            ec2: [{ id: "vm-123", name: "my-azure-vm", region: "eastus" }],
            rds: [{ id: "db-123", name: "my-azure-sql", region: "eastus" }],
            s3: [{ id: "storage-123", name: "my-azure-storage", region: "eastus" }],
            autoscaling: [{ id: "vmss-123", name: "my-azure-vmss", region: "eastus" }],
            ecr: [{ id: "acr-123", name: "my-azure-acr", region: "eastus" }],
            alb: [
                { id: "/subscriptions/123/resourceGroups/rg/providers/Microsoft.Network/loadBalancers/my-lb", name: "my-lb", region: "eastus" },
                { id: "/subscriptions/123/resourceGroups/rg/providers/Microsoft.Network/applicationGateways/my-gw", name: "my-gw", region: "eastus" }
            ],
            lambda: [{ id: "/subscriptions/123/resourceGroups/rg/providers/Microsoft.Web/sites/my-func", name: "my-func", region: "eastus", type: "functionapp" }],
            counts: { total: 7 }
        })
    }
};

(require.cache as any)[azureAlertsRulesPath] = {
    id: azureAlertsRulesPath,
    filename: azureAlertsRulesPath,
    loaded: true,
    exports: {
        getAzureAlertRules: async () => ({
            alarms: [],
            counts: { total: 0, alarm: 0, ok: 0, insufficient: 0 }
        }),
        putAzureMetricAlert: async () => ({ success: true, message: "Mocked successful" })
    }
};

(require.cache as any)[gcpResourcesPath] = {
    id: gcpResourcesPath,
    filename: gcpResourcesPath,
    loaded: true,
    exports: {
        getResources: async () => ({
            ec2: [{ id: "gce-123", name: "my-gcp-gce", region: "us-central1" }],
            rds: [{ id: "sql-123", name: "my-gcp-sql", region: "us-central1" }],
            s3: [{ id: "bucket-123", name: "my-gcp-bucket", region: "us-central1" }],
            autoscaling: [{ id: "mig-123", name: "my-gcp-mig", region: "us-central1" }],
            eks: [{ id: "gke-123", name: "my-gcp-gke", region: "us-central1" }],
            ecr: [{ id: "repo-123", name: "my-gcp-repo", region: "us-central1" }],
            alb: [{ id: "rule-123", name: "my-gcp-lb", region: "us-central1" }],
            lambda: [
                { id: "projects/123/locations/us-central1/functions/my-func", name: "my-func", region: "us-central1" },
                { id: "projects/123/locations/us-central1/services/my-run", name: "my-run", region: "us-central1" }
            ],
            counts: { total: 9 }
        })
    }
};

(require.cache as any)[gcpAlertRulesPath] = {
    id: gcpAlertRulesPath,
    filename: gcpAlertRulesPath,
    loaded: true,
    exports: {
        getGcpAlertRules: async () => ({
            alarms: [],
            counts: { total: 0, alarm: 0, ok: 0, insufficient: 0 }
        }),
        putGcpMetricAlert: async () => ({ success: true, message: "Mocked successful" })
    }
};

// Now import the default alarms services
const { previewDefaultAlarms: previewAzureAlarms } = require("./services/azure/default-alarms.service");
const { previewDefaultAlarms: previewGcpAlarms } = require("./services/gcp/default-alarms.service");

// Run direct verification tests
async function runTests() {
    console.log("=== RUNNING ALARMS EXPANSION TESTS ===");

    // 1. Test Azure Alarms preview
    console.log("\n--- Azure Preview ---");
    const azureRes = await previewAzureAlarms(
        "user-123",
        "tenant-123",
        "sub-123",
        "client-123",
        "secret-123"
    );
    console.log("Azure Preview Summary:", JSON.stringify(azureRes.summary, null, 2));

    const expectedAzureKeys = ["vm", "sql", "storage", "vmss", "acr", "lb", "functions"];
    const actualAzureKeys = Object.keys(azureRes.summary);
    const hasAllAzure = expectedAzureKeys.every(k => actualAzureKeys.includes(k));

    console.log(`Azure Coverage matches all keys: ${hasAllAzure} (${actualAzureKeys.join(", ")})`);

    // Verify lb custom target paths
    console.log("Azure LB Alarm Count (Expected: 2):", azureRes.summary.lb?.count);
    console.log("Azure Functions Alarm Count (Expected: 2):", azureRes.summary.functions?.count);

    // 2. Test GCP Alarms preview
    console.log("\n--- GCP Preview ---");
    const gcpRes = await previewGcpAlarms(
        "user-123",
        "project-123",
        "email-123",
        "key-123"
    );
    console.log("GCP Preview Summary:", JSON.stringify(gcpRes.summary, null, 2));

    const expectedGcpKeys = ["vm", "sql", "storage", "mig", "gke", "artifactregistry", "lb", "functions"];
    const actualGcpKeys = Object.keys(gcpRes.summary);
    const hasAllGcp = expectedGcpKeys.every(k => actualGcpKeys.includes(k));

    console.log(`GCP Coverage matches all keys: ${hasAllGcp} (${actualGcpKeys.join(", ")})`);

    // Verify functions vs run filtering
    console.log("GCP Functions Alarm Count (Expected: 2):", gcpRes.summary.functions?.count);

    const azureOk = hasAllAzure && azureRes.summary.lb?.count === 2 && azureRes.summary.functions?.count === 2;
    const gcpOk = hasAllGcp && gcpRes.summary.functions?.count === 2;

    if (azureOk && gcpOk) {
        console.log("\n>>> ALL DEFAULT ALARM VERIFICATIONS PASSED! <<<");
        process.exit(0);
    } else {
        console.error("\n>>> VERIFICATION FAILURE! <<<");
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
