import { Request } from "express";
import { getCredentials } from "../../../store/workspace-credentials";
import { resolveProvider } from "../../../middleware/credentials.middleware";

export function getUserId(req: Request): string {
  return (req as any).user.userId;
}

export async function loadUserCreds(req: Request) {
  const userId = getUserId(req);
  const provider = resolveProvider(req);
  const creds = await getCredentials(userId, provider);
  return {
    userId,
    provider,
    connectionId: creds?.connectionId,
    roleArn: creds?.roleArn,
    externalId: creds?.externalId,
  };
}

export function isDefaultAlarmName(name: string): boolean {
  return name.startsWith("rabbittwatch-");
}

export function isAwsAccessDenied(error: any): boolean {
  const text = `${error?.name || ""} ${error?.Code || ""} ${error?.code || ""} ${error?.message || ""}`;
  return /AccessDenied|UnauthorizedOperation|not authorized/i.test(text);
}

export function alarmErrorStatus(error: any): number {
  return isAwsAccessDenied(error) ? 403 : 500;
}

export function alarmErrorMessage(error: any, fallback: string): string {
  if (isAwsAccessDenied(error)) {
    return `${fallback}. AWS role permissions are missing for this CloudWatch action. Update the AWS integration stack to the latest template.`;
  }
  return error.message || fallback;
}
