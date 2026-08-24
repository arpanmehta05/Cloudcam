import { Request, Response } from "express";
import {
  runDeployment,
  runLiveActionDeployment,
  resolveGcpCredentialPayload,
  validateAwsCredentials,
  validateGcpCredentials,
} from "../../services/deployment/deployment.service";
import { getSession, updateSession } from "../../services/deployment/store";
import { removeContainer } from "../../../../services/container-manager";
import { resolveCredentialPayload } from "../../../../services/aws-credential-vault.service";
import {
  validateAzureCredentials,
  validateAzureDeploymentPermissions,
  discoverAzureVnetAndSubnet,
} from "../../../../modules/azure/services/save-connection.service";
import { resolveAzureCredentialPayload } from "./credentials.controller";
import { getParam, getUserId } from "./shared";

// POST /api/deployment/:id/run
export async function deploymentRunPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const deploymentId = getParam(req, "id");
    const session = await getSession(deploymentId);

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Deployment session not found" });
    }

    if (session.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, error: "Not authorized for this deployment" });
    }

    if (session.status === "running") {
      return res
        .status(400)
        .json({ success: false, error: "Deployment is already running" });
    }

    if (session.status === "failed" || session.status === "cancelled") {
      if (session.containerId) {
        await removeContainer(session.containerId);
      }
      await updateSession(deploymentId, {
        status: "waiting_creds",
        errorMessage: undefined,
      });
    }

    const provider =
      req.body?.provider ||
      (session.nodes?.[0]?.serviceId?.startsWith("gcp_")
        ? "gcp"
        : session.nodes?.[0]?.serviceId?.startsWith("azure")
          ? "azure"
          : "aws");

    if (provider === "azure") {
      const azureCreds = await resolveAzureCredentialPayload(
        userId,
        req.body || {},
      );
      const isValid = await validateAzureCredentials(azureCreds);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid Azure credentials or insufficient subscription access permissions.",
        });
      }

      const permissionCheck = await validateAzureDeploymentPermissions(
        azureCreds,
        process.env.AZURE_RESOURCE_GROUP,
      );
      if (!permissionCheck.valid) {
        console.warn(
          `[deployment] Azure permission pre-flight warning (non-blocking): ${permissionCheck.error}`,
        );
      }

      const isVmContributor = permissionCheck.isVmContributor || false;
      let existingVnetName: string | undefined = undefined;
      let existingSubnetName: string | undefined = undefined;

      if (isVmContributor && process.env.AZURE_RESOURCE_GROUP) {
        const discoveredNet = await discoverAzureVnetAndSubnet(
          azureCreds,
          process.env.AZURE_RESOURCE_GROUP,
        );
        existingVnetName = discoveredNet.vnetName;
        existingSubnetName = discoveredNet.subnetName;
        console.log(
          `[deployment] User has VM Contributor role. Auto-discovered VNet: ${existingVnetName || "none"}, Subnet: ${existingSubnetName || "none"}`,
        );
      }

      if (session.hcl) {
        runLiveActionDeployment(
          deploymentId,
          session.hcl,
          "",
          "",
          "",
          session.region || "eastus",
          {
            provider: "azure",
            azure: azureCreds,
            isVmContributor,
            existingVnetName,
            existingSubnetName,
          },
        ).catch(async (err) => {
          console.error("[deployment] Live Run error:", err);
          await updateSession(deploymentId, {
            status: "failed",
            errorMessage: err?.message || "Deployment failed to start",
          });
        });
      } else {
        runDeployment(deploymentId, "", "", "", session.region || "eastus", {
          provider: "azure",
          azure: azureCreds,
          isVmContributor,
          existingVnetName,
          existingSubnetName,
        }).catch(async (err) => {
          console.error("[deployment] Run error:", err);
          await updateSession(deploymentId, {
            status: "failed",
            errorMessage: err?.message || "Deployment failed to start",
          });
        });
      }

      return res.json({
        success: true,
        deploymentId,
        accountId: azureCreds.subscriptionId,
      });
    }

    if (provider === "gcp") {
      const gcpCreds = await resolveGcpCredentialPayload(
        userId,
        req.body || {},
      );
      const info = await validateGcpCredentials(gcpCreds);

      if (session.hcl) {
        runLiveActionDeployment(
          deploymentId,
          session.hcl,
          "",
          "",
          "",
          session.region || "us-central1",
          {
            provider: "gcp",
            gcp: gcpCreds,
          },
        ).catch(async (err) => {
          console.error("[deployment] Live Run error:", err);
          await updateSession(deploymentId, {
            status: "failed",
            errorMessage: err?.message || "Deployment failed to start",
          });
        });
      } else {
        runDeployment(
          deploymentId,
          "",
          "",
          "",
          session.region || "us-central1",
          {
            provider: "gcp",
            gcp: gcpCreds,
          },
        ).catch(async (err) => {
          console.error("[deployment] Run error:", err);
          await updateSession(deploymentId, {
            status: "failed",
            errorMessage: err?.message || "Deployment failed to start",
          });
        });
      }

      return res.json({
        success: true,
        deploymentId,
        accountId: info.accountId,
      });
    }

    const { accessKeyId, secretAccessKey, sessionToken, region } =
      await resolveCredentialPayload(userId, req.body || {});

    const info = await validateAwsCredentials(
      accessKeyId,
      secretAccessKey,
      sessionToken || "",
      region || "us-east-1",
    );

    if (session.hcl) {
      runLiveActionDeployment(
        deploymentId,
        session.hcl,
        accessKeyId,
        secretAccessKey,
        sessionToken || "",
        region || session.region || "us-east-1",
      ).catch(async (err) => {
        console.error("[deployment] Live Run error:", err);
        await updateSession(deploymentId, {
          status: "failed",
          errorMessage: err?.message || "Deployment failed to start",
        });
      });
    } else {
      runDeployment(
        deploymentId,
        accessKeyId,
        secretAccessKey,
        sessionToken || "",
        region || session.region || "us-east-1",
      ).catch(async (err) => {
        console.error("[deployment] Run error:", err);
        await updateSession(deploymentId, {
          status: "failed",
          errorMessage: err?.message || "Deployment failed to start",
        });
      });
    }

    return res.json({
      success: true,
      deploymentId,
      accountId: info.accountId,
    });
  } catch (err: any) {
    console.error("[deployment] Run error:", err);
    return res.status(400).json({
      success: false,
      error: err?.message || "Failed to run deployment",
    });
  }
}
