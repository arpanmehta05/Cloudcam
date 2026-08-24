import { ECRClient, DescribeImagesCommand } from "@aws-sdk/client-ecr";
import axios from "axios";
import { createGcpAuthClient } from "../../../../modules/gcp/providers/client-factory";

export async function verifyEcrImageExists(
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  repositoryName: string,
  imageTag: string,
  options: {
    provider?: "aws" | "azure" | "gcp";
    azure?: {
      clientId: string;
      clientSecret: string;
      tenantId: string;
      subscriptionId: string;
    };
    gcp?: {
      projectId: string;
      clientEmail: string;
      privateKey: string;
    };
    nodeId?: string;
  } = {}
): Promise<boolean> {
  if (process.env.SKIP_ECR_IMAGE_CHECK === "true") {
    console.log(`[deployment] SKIP_ECR_IMAGE_CHECK is enabled. Bypassing check for registry repository '${repositoryName}:${imageTag}'`);
    return true;
  }

  const provider = options.provider || "aws";

  if (provider === "azure" && options.azure) {
    try {
      const { tenantId, clientId, clientSecret } = options.azure;
      const rawRegistryName = repositoryName || "simregistry";
      const registryName = rawRegistryName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 50);
      const loginServer = `${registryName}.azurecr.io`;
      
      const nodeId = options.nodeId || "ecr_node";
      const imageName = `sim_${nodeId.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      
      // 1. Get Azure AD token for container registry resource
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams();
      params.append("grant_type", "client_credentials");
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);
      params.append("scope", "https://containerregistry.azure.net/.default");

      const tokenRes = await axios.post(tokenUrl, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      });
      const aadToken = tokenRes.data.access_token;
      if (!aadToken) throw new Error("No registry access token returned");

      // 2. Exchange for ACR refresh token
      const exchangeUrl = `https://${loginServer}/oauth2/exchange`;
      const exchangeParams = new URLSearchParams();
      exchangeParams.append("grant_type", "access_token");
      exchangeParams.append("service", loginServer);
      exchangeParams.append("tenant", tenantId);
      exchangeParams.append("access_token", aadToken);

      const exchangeRes = await axios.post(exchangeUrl, exchangeParams, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      });
      const refresh_token = exchangeRes.data.refresh_token;
      if (!refresh_token) throw new Error("No ACR refresh token returned");

      // 3. Exchange for ACR access token (scope repository pull)
      const tokenExchangeUrl = `https://${loginServer}/oauth2/token`;
      const tokenParams = new URLSearchParams();
      tokenParams.append("grant_type", "refresh_token");
      tokenParams.append("service", loginServer);
      tokenParams.append("scope", `repository:${imageName}:pull`);
      tokenParams.append("refresh_token", refresh_token);

      const acrTokenRes = await axios.post(tokenExchangeUrl, tokenParams, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      });
      const acrAccessToken = acrTokenRes.data.access_token;
      if (!acrAccessToken) throw new Error("No ACR access token returned");

      // 4. Verify tag exists using Docker Registry API HEAD request
      const manifestUrl = `https://${loginServer}/v2/${imageName}/manifests/${imageTag}`;
      const headRes = await axios.head(manifestUrl, {
        headers: { Authorization: `Bearer ${acrAccessToken}` },
        validateStatus: (status) => status === 200 || status === 404,
      });

      return headRes.status === 200;
    } catch (err: any) {
      console.error(`[deployment] Azure ACR image verification failed:`, err.response?.data || err.message);
      return false;
    }
  }

  if (provider === "gcp" && options.gcp) {
    try {
      const gcpCreds = options.gcp;
      const repositoryId = repositoryName || "sim-repo";
      const nodeId = options.nodeId || "ecr_node";
      const imageName = `sim_${nodeId.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      
      const auth = createGcpAuthClient(gcpCreds);
      const tokenResponse = await auth.getAccessToken();
      const accessToken = tokenResponse.token;
      if (!accessToken) throw new Error("Failed to get GCP access token");

      // Google Artifact Registry Tag API
      const url = `https://artifactregistry.googleapis.com/v1/projects/${gcpCreds.projectId}/locations/${region}/repositories/${repositoryId}/packages/${imageName}/tags/${imageTag}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: (status) => status === 200 || status === 404,
      });

      return res.status === 200;
    } catch (err: any) {
      console.error(`[deployment] GCP Artifact Registry verification failed:`, err.response?.data || err.message);
      return false;
    }
  }

  // AWS (default behavior)
  const ecrClient = new ECRClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken: sessionToken || undefined,
    },
  });

  try {
    const response = await ecrClient.send(
      new DescribeImagesCommand({
        repositoryName,
        imageIds: [{ imageTag }],
      })
    );
    return (response.imageDetails && response.imageDetails.length > 0) || false;
  } catch (err: any) {
    if (err.name === "ImageNotFoundException" || err.name === "RepositoryNotFoundException") {
      return false;
    }
    throw err;
  }
}
