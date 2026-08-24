import { Request } from "express";
import { getCredentials } from "../../../store/workspace-credentials";

export function getUserId(req: Request): string {
  return (req as any).user.userId;
}

export async function loadAzureCreds(req: Request) {
  const userId = getUserId(req);
  const creds = await getCredentials(userId, "azure");
  const { config } = require("../../../config/env");
  return {
    userId,
    tenantId: creds?.tenantId,
    subscriptionId: creds?.subscriptionId,
    billingAccountId: creds?.billingAccountId,
    clientId: creds?.clientId || config.azure.clientId,
    clientSecret: creds?.clientSecret || config.azure.clientSecret,
  };
}
