import { Request } from "express";
import { getCredentials } from "../../../store/workspace-credentials";

export function getUserId(req: Request): string {
  return (req as any).user.userId;
}

export async function loadGcpCreds(req: Request) {
  const userId = getUserId(req);
  const creds = await getCredentials(userId, "gcp");
  return {
    userId,
    projectId: creds?.projectId,
    clientEmail: creds?.clientEmail,
    privateKey: creds?.privateKey,
    billingDatasetId: creds?.billingDatasetId,
    billingTableId: creds?.billingTableId,
  };
}
