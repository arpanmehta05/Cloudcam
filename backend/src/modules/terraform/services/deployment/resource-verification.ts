import axios from "axios";
import { getAzureAccessToken } from "../../../../modules/azure/providers/client-factory";
import { createGcpAuthClient } from "../../../../modules/gcp/providers/client-factory";
import { appendDeploymentLog } from "./store";

export async function verifyDeployedResources(
  deploymentId: string,
  provider: "aws" | "azure" | "gcp" | undefined,
  nodes: any[],
  outputs: any,
  options: any
): Promise<void> {
  if (!provider || provider === "aws") return; // AWS doesn't have post-deploy checks requested

  if (provider === "azure" && options.azure) {
    const { tenantId, clientId, clientSecret, subscriptionId } = options.azure;
    let token: string;
    try {
      token = await getAzureAccessToken(tenantId, clientId, clientSecret);
    } catch (err: any) {
      appendDeploymentLog(deploymentId, `[verification] Skipped Azure resource verification: auth failed (${err.message})`, "stderr");
      return;
    }

    // 1. Find deployed Azure APIM, Cosmos DB, and ACR
    const apimNodes = nodes.filter((n) => n.serviceId === "apigateway");
    const cosmosNodes = nodes.filter((n) => n.serviceId === "dynamodb");
    const acrNodes = nodes.filter((n) => n.serviceId === "ecr");

    for (const node of apimNodes) {
      const apimName = node.config?.serviceName || `sim-apim-${node.id}`;
      const rg = process.env.AZURE_RESOURCE_GROUP || "simulations";
      const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rg}/providers/Microsoft.ApiManagement/service/${apimName}?api-version=2022-08-01`;

      appendDeploymentLog(deploymentId, `[verification] Verifying Azure API Management: ${apimName}...`, "stdout");
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const state = res.data?.properties?.provisioningState;
        appendDeploymentLog(deploymentId, `[verification] Azure API Management '${apimName}' provisioning state: ${state || "unknown"}`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify Azure API Management '${apimName}': ${err.message}`, "stdout");
      }
    }

    for (const node of cosmosNodes) {
      const dbName = node.config?.accountName || `sim-cosmos-${node.id}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
      const rg = process.env.AZURE_RESOURCE_GROUP || "simulations";
      const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rg}/providers/Microsoft.DocumentDB/databaseAccounts/${dbName}?api-version=2023-04-15`;

      appendDeploymentLog(deploymentId, `[verification] Verifying Azure Cosmos DB Account: ${dbName}...`, "stdout");
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const state = res.data?.properties?.provisioningState;
        appendDeploymentLog(deploymentId, `[verification] Azure Cosmos DB '${dbName}' provisioning state: ${state || "unknown"}`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify Azure Cosmos DB '${dbName}': ${err.message}`, "stdout");
      }
    }

    for (const node of acrNodes) {
      const rawName = node.config?.registryName || node.config?.repositoryName || "simregistry";
      const acrName = rawName.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 50);
      const rg = process.env.AZURE_RESOURCE_GROUP || "simulations";
      const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rg}/providers/Microsoft.ContainerRegistry/registries/${acrName}?api-version=2023-07-01`;

      appendDeploymentLog(deploymentId, `[verification] Verifying Azure Container Registry: ${acrName}...`, "stdout");
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const state = res.data?.properties?.provisioningState;
        appendDeploymentLog(deploymentId, `[verification] Azure ACR '${acrName}' provisioning state: ${state || "unknown"}`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify Azure ACR '${acrName}': ${err.message}`, "stdout");
      }
    }

    const aksNodes = nodes.filter((n) => n.serviceId === "azure_aks" || n.serviceId === "eks" || n.serviceId === "ecs");
    for (const node of aksNodes) {
      const clusterName = node.config?.clusterName || node.config?.serviceName || `sim-aks-${node.id.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
      const rg = process.env.AZURE_RESOURCE_GROUP || "simulations";
      const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rg}/providers/Microsoft.ContainerService/managedClusters/${clusterName}?api-version=2023-08-01`;

      appendDeploymentLog(deploymentId, `[verification] Verifying Azure AKS Cluster: ${clusterName}...`, "stdout");
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const state = res.data?.properties?.provisioningState;
        appendDeploymentLog(deploymentId, `[verification] Azure AKS '${clusterName}' provisioning state: ${state || "unknown"}`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify Azure AKS '${clusterName}': ${err.message}`, "stdout");
      }
    }
  }

  if (provider === "gcp" && options.gcp) {
    const gcpCreds = options.gcp;
    let accessToken: string;
    try {
      const auth = createGcpAuthClient(gcpCreds);
      const tokenResponse = await auth.getAccessToken();
      accessToken = tokenResponse.token;
    } catch (err: any) {
      appendDeploymentLog(deploymentId, `[verification] Skipped GCP resource verification: auth failed (${err.message})`, "stderr");
      return;
    }

    const gatewayNodes = nodes.filter((n) => n.serviceId === "apigateway");
    const firestoreNodes = nodes.filter((n) => n.serviceId === "dynamodb");
    const arNodes = nodes.filter((n) => n.serviceId === "ecr");
    const gkeNodes = nodes.filter((n) => n.serviceId === "gcp_gke" || n.serviceId === "eks");
    const runNodes = nodes.filter((n) => n.serviceId === "gcp_cloud_run" || n.serviceId === "ecs");

    const region = options.region || "us-central1";

    for (const node of gatewayNodes) {
      const gatewayId = node.config?.gatewayId || `sim-gw-${node.id}`;
      const url = `https://apigateway.googleapis.com/v1/projects/${gcpCreds.projectId}/locations/${region}/gateways/${gatewayId}`;

      appendDeploymentLog(deploymentId, `[verification] Verifying GCP API Gateway: ${gatewayId}...`, "stdout");
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const state = res.data?.state;
        appendDeploymentLog(deploymentId, `[verification] GCP API Gateway '${gatewayId}' state: ${state || "unknown"}`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify GCP API Gateway '${gatewayId}': ${err.message}`, "stdout");
      }
    }

    for (const node of firestoreNodes) {
      const dbName = node.config?.databaseId || "(default)";
      const url = `https://firestore.googleapis.com/v1/projects/${gcpCreds.projectId}/databases/${dbName}`;

      appendDeploymentLog(deploymentId, `[verification] Verifying GCP Firestore Database: ${dbName}...`, "stdout");
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const state = res.data?.state;
        appendDeploymentLog(deploymentId, `[verification] GCP Firestore Database '${dbName}' state: ${state || "unknown"}`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify GCP Firestore Database '${dbName}': ${err.message}`, "stdout");
      }
    }

    for (const node of arNodes) {
      const repoId = node.config?.repositoryId || node.config?.repositoryName || "sim-repo";
      const url = `https://artifactregistry.googleapis.com/v1/projects/${gcpCreds.projectId}/locations/${region}/repositories/${repoId}`;

      appendDeploymentLog(deploymentId, `[verification] Verifying GCP Artifact Registry: ${repoId}...`, "stdout");
      try {
        await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        appendDeploymentLog(deploymentId, `[verification] GCP Artifact Registry '${repoId}' exists and is active.`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify GCP Artifact Registry '${repoId}': ${err.message}`, "stdout");
      }
    }

    for (const node of gkeNodes) {
      const clusterName = node.config?.clusterName || node.config?.serviceName || `sim-gke-${node.id}`;
      const url = `https://container.googleapis.com/v1/projects/${gcpCreds.projectId}/locations/${region}/clusters/${clusterName}`;

      appendDeploymentLog(deploymentId, `[verification] Verifying GCP GKE Cluster: ${clusterName}...`, "stdout");
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const state = res.data?.status;
        appendDeploymentLog(deploymentId, `[verification] GCP GKE Cluster '${clusterName}' status: ${state || "unknown"}`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify GCP GKE Cluster '${clusterName}': ${err.message}`, "stdout");
      }
    }

    for (const node of runNodes) {
      const serviceName = (node.config?.serviceName || node.config?.clusterName || `sim-run-${node.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .substring(0, 50);
      const url = `https://run.googleapis.com/v2/projects/${gcpCreds.projectId}/locations/${region}/services/${serviceName}`;

      appendDeploymentLog(deploymentId, `[verification] Verifying GCP Cloud Run Service: ${serviceName}...`, "stdout");
      try {
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const state = res.data?.terminalCondition?.state || "unknown";
        appendDeploymentLog(deploymentId, `[verification] GCP Cloud Run Service '${serviceName}' state: ${state}`, "stdout");
      } catch (err: any) {
        appendDeploymentLog(deploymentId, `[verification] Warning: Could not verify GCP Cloud Run Service '${serviceName}': ${err.message}`, "stdout");
      }
    }
  }
}
