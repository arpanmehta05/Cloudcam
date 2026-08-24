import { Request, Response } from "express";
import { resolveCredentialPayload } from "../../../../services/aws-credential-vault.service";
import { getCredentials } from "../../../../store/workspace-credentials";
import {
  resolveGcpCredentialPayload,
  validateAwsCredentials,
  validateGcpCredentials,
} from "../../services/deployment/deployment.service";
import { validateAzureCredentials } from "../../../../modules/azure/services/save-connection.service";
import { getUserId } from "./shared";

export async function resolveAzureCredentialPayload(
  userId: string,
  body: any,
): Promise<{
  tenantId: string;
  subscriptionId: string;
  clientId: string;
  clientSecret: string;
}> {
  const credentialVaultId =
    typeof body?.credentialVaultId === "string"
      ? body.credentialVaultId.trim()
      : "";

  if (credentialVaultId === "saved") {
    const creds = await getCredentials(userId, "azure");
    const tenantId = creds?.tenantId;
    const subscriptionId = creds?.subscriptionId;
    const clientId =
      creds?.clientId || require("../../config/env").config.azure.clientId;
    const clientSecret =
      creds?.clientSecret || require("../../config/env").config.azure.clientSecret;

    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      throw new Error(
        "No saved Azure integration credentials found for this workspace.",
      );
    }
    return {
      tenantId,
      subscriptionId,
      clientId,
      clientSecret,
    };
  }

  const tenantId =
    typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
  const subscriptionId =
    typeof body?.subscriptionId === "string" ? body.subscriptionId.trim() : "";
  const clientId =
    typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret =
    typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";

  if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
    throw new Error(
      "Missing manual Azure credential parameters (tenantId, subscriptionId, clientId, clientSecret).",
    );
  }

  return {
    tenantId,
    subscriptionId,
    clientId,
    clientSecret,
  };
}

// POST /api/deployment/validate-creds
export async function validateCredsPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const provider = req.body?.provider || "aws";

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
      return res.json({
        success: true,
        accountId: azureCreds.subscriptionId,
        arn: `Azure Subscription: ${azureCreds.subscriptionId}`,
      });
    }

    if (provider === "gcp") {
      const gcpCreds = await resolveGcpCredentialPayload(
        userId,
        req.body || {},
      );
      const info = await validateGcpCredentials(gcpCreds);
      return res.json({
        success: true,
        accountId: info.accountId,
        arn: info.arn,
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

    return res.json({
      success: true,
      accountId: info.accountId,
      arn: info.arn,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: `Invalid credentials: ${err?.message || "authentication failed"}`,
    });
  }
}
