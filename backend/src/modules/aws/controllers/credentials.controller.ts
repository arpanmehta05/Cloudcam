import { Request, Response } from "express";
import { getWorkspaceCredentials } from "../services/credentials/credentials.service";
import { saveRole } from "../services/credentials/save-role.service";
import { resolveProvider } from "../../../middleware/credentials.middleware";
import { disconnectProvider } from "../../../store/workspace-credentials";
import { getCached, setCached, invalidateUser, CacheTTL } from "../../../middleware/response-cache";
import { getUserId } from "./helpers";

export async function credentialsGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const cached = getCached(userId, req);
    if (cached) return res.json(cached.data);
    const result = await getWorkspaceCredentials(userId, resolveProvider(req));
    setCached(userId, req, result, CacheTTL.CREDENTIALS);
    res.json(result);
  } catch (error) {
    console.error("[API Credentials] Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Authentication or setup issue" });
  }
}

export async function credentialsDelete(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const provider = resolveProvider(req);
    await disconnectProvider(userId, provider);
    invalidateUser(userId);
    res.json({ success: true, connected: false, provider });
  } catch (error: any) {
    console.error("[API Credentials Delete] Error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to disconnect provider",
      });
  }
}

export async function saveRolePost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const { roleArn, externalId, enabledModules, logForwardingEnabled } =
      req.body;
    if (!roleArn) return res.status(400).json({ error: "Missing roleArn" });
    const result = await saveRole(
      userId,
      roleArn,
      externalId,
      enabledModules,
      logForwardingEnabled,
    );
    invalidateUser(userId); // Clear all cached data when credentials change
    res.json(result);
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
