import { Request, Response } from "express";
import {
  deleteVaultCredential,
  listVaultCredentials,
  saveVaultCredential,
} from "../services/aws-credential-vault.service";
import { validateAwsCredentials } from "../../../services/terraform-deployment.service";

function getUserId(req: Request): string | null {
  return (req as any).user?.userId || null;
}

export async function vaultCredentialsGet(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });
    const credentials = await listVaultCredentials(userId);
    return res.json({ success: true, credentials });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        success: false,
        error: err?.message || "Failed to load saved credentials",
      });
  }
}

export async function vaultCredentialsPost(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const { name, accessKeyId, secretAccessKey, sessionToken, defaultRegion } =
      req.body || {};
    const region = defaultRegion || "us-east-1";
    const identity = await validateAwsCredentials(
      accessKeyId,
      secretAccessKey,
      sessionToken || "",
      region,
    );
    const credential = await saveVaultCredential(userId, {
      name,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      defaultRegion: region,
    });

    return res.status(201).json({ success: true, credential, identity });
  } catch (err: any) {
    return res
      .status(400)
      .json({
        success: false,
        error: err?.message || "Failed to save credential",
      });
  }
}

export async function vaultCredentialDelete(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });
    const deleted = await deleteVaultCredential(userId, String(req.params.id));
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, error: "Saved credential not found" });
    return res.json({ success: true });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        success: false,
        error: err?.message || "Failed to delete credential",
      });
  }
}
