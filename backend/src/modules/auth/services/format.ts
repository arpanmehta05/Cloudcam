import { IUser } from "../models/user.model";

export function formatUser(user: IUser, recentLogins?: any[]) {
  const defaultWorkspaceId = user.defaultWorkspaceId || user._id.toString();
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    provider: user.provider,
    avatarUrl: user.avatarUrl || null,
    permissionLevel: user.permissionLevel,
    isSystemAdmin: !!user.isSystemAdmin,
    hasPassword: !!user.passwordHash,
    twoFactorEnabled: !!user.twoFactorEnabled,
    twoFactorMethod: user.twoFactorMethod || "email",
    twoFactorAuthenticatorConfigured: !!user.twoFactorTotpSecret,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    tenantId: user.tenantId || user._id.toString(),
    defaultWorkspaceId,
    workspaces: user.workspaces?.length
      ? user.workspaces
      : [defaultWorkspaceId],
    awsConnected: !!user.awsCredentials?.roleArn,
    azureConnected:
      !!user.azureCredentials?.subscriptionId ||
      !!user.cloudConnections?.some(
        (connection) =>
          connection.provider === "azure" &&
          !!connection.credentials?.subscriptionId,
      ),
    gcpConnected:
      !!user.gcpCredentials?.projectId ||
      !!user.cloudConnections?.some(
        (connection) =>
          connection.provider === "gcp" &&
          !!connection.credentials?.projectId,
      ),
    githubConnected: !!user.githubCredentials?.accessToken,
    awsCredentials: user.awsCredentials?.roleArn
      ? {
          roleArn: user.awsCredentials.roleArn,
          externalId: user.awsCredentials.externalId,
          connectedAt: user.awsCredentials.connectedAt,
        }
      : null,
    usageReportPreferences: {
      enabled: !!user.usageReportPreferences?.enabled,
      frequency: user.usageReportPreferences?.frequency || "weekly",
      lastSentAt: user.usageReportPreferences?.lastSentAt || null,
      nextSendAt: user.usageReportPreferences?.nextSendAt || null,
    },
    recentLogins: recentLogins
      ? recentLogins.map((log) => ({
          provider: log.provider,
          ip: log.ip,
          userAgent: log.userAgent,
          loggedAt:
            log.loggedAt instanceof Date
              ? log.loggedAt.toISOString()
              : String(log.loggedAt),
          user:
            log.userId && typeof log.userId === "object"
              ? {
                  id: (log.userId as any)._id?.toString(),
                  name: (log.userId as any).name,
                  email: (log.userId as any).email,
                  username: (log.userId as any).username,
                }
              : null,
        }))
      : [],
    username: user.username || null,
    pinnedServices: user.pinnedServices || [],
  };
}
