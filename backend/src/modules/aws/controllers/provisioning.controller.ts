// AWS Provisioning Controller — connect / test / disconnect / status
import { Request, Response } from "express";
import {
  connectIAM,
  connectOIDC,
  testConnection,
  disconnect,
  getStatus,
} from "../services/setup/provisioning.service";
import { validateInfrastructure } from "../services/graph-validation.service";
import { invalidateUser } from "../../../middleware/response-cache";

function getUserId(req: Request): string {
  return (req as any).user.userId;
}

export async function validateGraphPost(req: Request, res: Response) {
  try {
    const { nodes = [], edges = [], region = "us-east-1" } = req.body;
    const result = validateInfrastructure(nodes, edges, region);
    res.json(result);
  } catch (error: any) {
    console.error("[AWS Provisioning Validate Graph] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to validate infrastructure graph",
      });
  }
}

export async function provisioningConnectPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const {
      authMethod,
      roleArn,
      externalId,
      webIdentityToken,
      providerArn,
      enabledModules,
      logForwardingEnabled,
    } = req.body;

    if (!roleArn) {
      return res
        .status(400)
        .json({ success: false, error: "roleArn is required" });
    }

    let result;
    if (authMethod === "oidc") {
      result = await connectOIDC(
        userId,
        roleArn,
        webIdentityToken,
        providerArn,
        enabledModules,
        logForwardingEnabled,
      );
    } else {
      if (!externalId) {
        return res
          .status(400)
          .json({
            success: false,
            error: "externalId is required for IAM auth method",
          });
      }
      result = await connectIAM(
        userId,
        roleArn,
        externalId,
        enabledModules,
        logForwardingEnabled,
      );
    }

    invalidateUser(userId);
    res.json(result);
  } catch (error: any) {
    console.error("[AWS Provisioning Connect] Error:", error);
    const status = error.message?.includes("required") ? 400 : 500;
    res
      .status(status)
      .json({
        success: false,
        error: error.message || "Failed to connect AWS account",
      });
  }
}

export async function provisioningTestPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const { webIdentityToken } = req.body || {};
    const result = await testConnection(userId, webIdentityToken);
    res.json(result);
  } catch (error: any) {
    console.error("[AWS Provisioning Test] Error:", error);
    const status = error.message?.includes("NOT_CONNECTED") ? 404 : 500;
    res
      .status(status)
      .json({
        success: false,
        error: error.message || "Failed to test connection",
      });
  }
}

export async function provisioningDisconnectPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const result = await disconnect(userId);
    res.json(result);
  } catch (error: any) {
    console.error("[AWS Provisioning Disconnect] Error:", error);
    res
      .status(500)
      .json({ success: false, error: error.message || "Failed to disconnect" });
  }
}

export async function provisioningStatusGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const result = await getStatus(userId);
    res.json(result);
  } catch (error: any) {
    console.error("[AWS Provisioning Status] Error:", error);
    res
      .status(500)
      .json({ success: false, error: error.message || "Failed to get status" });
  }
}
