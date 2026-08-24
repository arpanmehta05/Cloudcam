import { Request } from "express";
import { User } from "../../../models/user.model";

export interface AiScope {
    userId: string;
    tenantId?: string;
    workspaceId?: string;
    environment?: string;
}

function pickString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export async function resolveAiScope(req: Request, userId: string): Promise<AiScope> {
    const tenantId = pickString(req.headers["x-tenant-id"]) || pickString(req.query.tenantId);
    const workspaceId = pickString(req.headers["x-workspace-id"]) || pickString(req.query.workspaceId);
    const environment =
        pickString(req.headers["x-environment"]) ||
        pickString(req.query.environment) ||
        "prod";

    if (!workspaceId) {
        return { userId, tenantId, environment };
    }

    const user = await User.findById(userId).select("workspaces");
    const userWorkspaces = Array.isArray((user as any)?.workspaces) ? (user as any).workspaces : [];
    if (userWorkspaces.length > 0 && !userWorkspaces.includes(workspaceId)) {
        const err = new Error("Workspace access denied");
        (err as any).status = 403;
        throw err;
    }

    return { userId, tenantId, workspaceId, environment };
}

export function buildScopeMatch(scope: AiScope): Record<string, any> {
    const match: Record<string, any> = { userId: scope.userId };
    if (scope.tenantId) match.tenantId = scope.tenantId;
    if (scope.workspaceId) match.workspaceId = scope.workspaceId;
    if (scope.environment) match.environment = scope.environment;
    return match;
}

export function hasExplicitEnvironment(req: Request): boolean {
    return (
        typeof req.headers["x-environment"] === "string" ||
        typeof req.query.environment === "string"
    );
}
