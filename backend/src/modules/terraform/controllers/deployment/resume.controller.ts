import { Request, Response } from "express";
import {
  resumeDeployment,
  resolveGcpCredentialPayload,
  validateAwsCredentials,
  validateGcpCredentials,
  verifyEcrImageExists,
} from "../../services/deployment/deployment.service";
import { getSession, updateSession } from "../../services/deployment/store";
import { resolveCredentialPayload } from "../../../../services/aws-credential-vault.service";
import { validateAzureCredentials } from "../../../../modules/azure/services/save-connection.service";
import { resolveAzureCredentialPayload } from "./credentials.controller";
import { getParam, getUserId } from "./shared";

// POST /api/deployment/:id/resume
export async function resumeDeploymentPost(req: Request, res: Response) {
  try {
    const deploymentId = getParam(req, "id");
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const session = await getSession(deploymentId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    if (session.status === "running") {
      return res.json({
        success: true,
        deploymentId,
        message: "Deployment is already running",
      });
    }

    const provider =
      req.body?.provider ||
      (session.nodes?.some((n: any) => n.serviceId?.startsWith("gcp_"))
        ? "gcp"
        : session.nodes?.some((n: any) => n.serviceId?.startsWith("azure_"))
          ? "azure"
          : "aws");

    let accessKeyId = "";
    let secretAccessKey = "";
    let sessionToken = "";
    let region = req.body?.region || session.region || (provider === "gcp" ? "us-central1" : provider === "azure" ? "eastus" : "us-east-1");
    let accountId = "";
    let resumeOptions: any = { provider };

    if (provider === "azure") {
      const azureCreds = await resolveAzureCredentialPayload(userId, req.body || {});
      const isValid = await validateAzureCredentials(azureCreds);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid Azure credentials or insufficient subscription access permissions.",
        });
      }
      accountId = azureCreds.subscriptionId;
      resumeOptions.azure = azureCreds;
    } else if (provider === "gcp") {
      const gcpCreds = await resolveGcpCredentialPayload(userId, req.body || {});
      const info = await validateGcpCredentials(gcpCreds);
      accountId = info.accountId;
      resumeOptions.gcp = gcpCreds;
    } else {
      // aws
      const vaultRes = await resolveCredentialPayload(userId, req.body || {});
      accessKeyId = vaultRes.accessKeyId || req.body?.accessKeyId;
      secretAccessKey = vaultRes.secretAccessKey || req.body?.secretAccessKey;
      sessionToken = vaultRes.sessionToken || req.body?.sessionToken;

      if (!accessKeyId || !secretAccessKey) {
        return res.status(400).json({
          success: false,
          error: "AWS Access Key ID and Secret Access Key are required to resume deployment",
        });
      }

      const info = await validateAwsCredentials(
        accessKeyId,
        secretAccessKey,
        sessionToken || "",
        region
      );
      accountId = info.accountId;
    }

    // Synchronously verify ECR images exist before resuming
    const newEcrNodes = session.nodes.filter(
      (n: any) => n.serviceId === "ecr" && n.config?.repositoryMode === "new"
    );

    for (const ecrNode of newEcrNodes) {
      const repoName = ecrNode.config?.repositoryName || "sim-repo";
      const tag = ecrNode.config?.imageTag || "latest";

      console.log(`[deployment] Verifying image ${repoName}:${tag} in region ${region} (sync, provider: ${provider})...`);
      const exists = await verifyEcrImageExists(
        region,
        accessKeyId,
        secretAccessKey,
        sessionToken || "",
        repoName,
        tag,
        {
          provider,
          azure: resumeOptions.azure,
          gcp: resumeOptions.gcp,
          nodeId: ecrNode.id,
        }
      );

      if (!exists) {
        return res.status(400).json({
          success: false,
          error: `Image '${tag}' was not found in registry repository '${repoName}'. Please build and push it before resuming.`,
        });
      }
    }

    // Update session status to running synchronously to prevent frontend race conditions
    await updateSession(deploymentId, { status: "running", region });

    // Trigger resume asynchronously
    resumeDeployment(
      deploymentId,
      accessKeyId,
      secretAccessKey,
      sessionToken || "",
      region,
      resumeOptions
    ).catch(async (err) => {
      console.error("[deployment] Resume error:", err);
      await updateSession(deploymentId, {
        status: "failed",
        errorMessage: err?.message || "Deployment failed to resume",
      });
    });

    return res.json({
      success: true,
      deploymentId,
      accountId,
    });
  } catch (err: any) {
    console.error("[deployment] resumeDeploymentPost error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to resume deployment",
    });
  }
}
