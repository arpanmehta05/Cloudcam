// Shared credentials middleware — eliminates 4 duplicate loadUserCreds() functions
import { Request, Response, NextFunction } from "express";
import { getCredentials } from "../store/workspace-credentials";
import { CloudProvider } from "../models/aws.model";
import { isCloudProvider } from "../providers/cloud/registry";

export interface AuthenticatedRequest extends Request {
  userContext: {
    userId: string;
    provider: CloudProvider;
    connectionId?: string;
    roleArn?: string;
    externalId?: string;
  };
}

/**
 * Middleware that loads user credentials from workspace-credentials store.
 * Attach to routes that need AWS credentials.
 * After this middleware, use `(req as AuthenticatedRequest).userContext`.
 */
export async function loadCredentials(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const provider = resolveProvider(req);
    const creds = await getCredentials(userId, provider);
    (req as AuthenticatedRequest).userContext = {
      userId,
      provider,
      connectionId: creds?.connectionId,
      roleArn: creds?.roleArn,
      externalId: creds?.externalId,
    };
    (req as any).cloudContext = {
      userId,
      provider,
      connectionId: creds?.connectionId,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function resolveProvider(req: Request): CloudProvider {
  const raw = (req.params.provider || req.query.provider || "aws") as string;
  return isCloudProvider(raw) ? raw : "aws";
}

export function cloudContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = (req as any).user?.userId;
  const provider = resolveProvider(req);
  if (!isCloudProvider(provider)) {
    res
      .status(400)
      .json({ success: false, error: "Unsupported cloud provider" });
    return;
  }
  (req as any).cloudContext = {
    userId,
    provider,
    connectionId: (req.query.connectionId || provider) as string,
  };
  next();
}

/**
 * Helper to extract userContext from request.
 * Use this in controller functions instead of calling loadUserCreds().
 */
export function getUserContext(req: Request): {
  userId: string;
  provider: CloudProvider;
  connectionId?: string;
  roleArn?: string;
  externalId?: string;
} {
  const ctx = (req as AuthenticatedRequest).userContext;
  if (!ctx) {
    // Fallback: load inline (backwards compat for routes without middleware)
    const userId = (req as any).user?.userId;
    const provider = resolveProvider(req);
    return { userId, provider };
  }
  return ctx;
}
