// Auth Middleware — JWT verification
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./services/jwt.service";
import { config } from "../../core/config";
import { User, PermissionLevel } from "./models/user.model";

export interface AuthRequest extends Request {
  user: { userId: string; email: string; permissionLevel?: string };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = Array.isArray(req.query.token)
      ? (req.query.token[0] as string)
      : (req.query.token as string);
  }
  token = token?.trim();

  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Authentication required" });
  }

  try {
    // Validate JWT token
    const payload = verifyToken(token);
    (req as any).user = payload;
    return next();
  } catch {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });
  }
}

// Allows either normal JWT auth OR webhook secret auth for the save-role pingback.
export function authOrWebhookSecret(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secretHeader =
    req.headers["x-rabbittize-secret"] || req.headers["x-Rabbittize-secret"];
  const providedSecret = Array.isArray(secretHeader)
    ? secretHeader[0]
    : secretHeader;

  if (providedSecret) {
    const validSecrets = [
      config.rabbittize.apiSecret,
      config.rabbittize.webhookSecret,
      config.azure.webhookSecret,
    ].filter(Boolean);

    if (validSecrets.length === 0) {
      return res
        .status(500)
        .json({ success: false, error: "Webhook secret is not configured" });
    }
    if (!validSecrets.includes(providedSecret)) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid webhook secret" });
    }

    const workspaceId =
      typeof req.body?.workspaceId === "string"
        ? req.body.workspaceId.trim()
        : "";
    if (!workspaceId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing workspaceId" });
    }

    (req as any).user = {
      userId: workspaceId,
      email: "webhook@Rabbittize.internal",
      permissionLevel: "admin",
    };
    return next();
  }

  return authMiddleware(req, res, next);
}

/**
 * Enforces role-based route access controls.
 */
export function requireRole(allowedRoles: PermissionLevel[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userPayload = (req as any).user;
      if (!userPayload) {
        return res
          .status(401)
          .json({ success: false, error: "Authentication required" });
      }

      const user = await User.findById(userPayload.userId).select(
        "permissionLevel tenantId",
      );
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      let role = user.permissionLevel || "operator";
      // Auto-promote tenant owner to admin if they are operator or viewer
      const isOwner = !user.tenantId || user.tenantId === user._id.toString();
      if (isOwner && role !== "admin") {
        user.permissionLevel = "admin";
        if (!user.tenantId) {
          user.tenantId = user._id.toString();
        }
        await user.save();
        role = "admin";
      }

      // Sync with active request payload
      userPayload.permissionLevel = role;

      if (!allowedRoles.includes(role)) {
        return res
          .status(403)
          .json({
            success: false,
            error: `Access denied: requires role ${allowedRoles.join(" or ")}`,
          });
      }

      return next();
    } catch (error: any) {
      return res
        .status(500)
        .json({
          success: false,
          error: error.message || "Authorization check failed",
        });
    }
  };
}

/**
 * Enforces SaaS System Admin route access controls.
 */
export async function requireSystemAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userPayload = (req as any).user;
    if (!userPayload) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    }

    const user = await User.findById(userPayload.userId).select(
      "isSystemAdmin twoFactorEnabled",
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    if (!user.isSystemAdmin) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Access denied: requires system administrator privileges",
        });
    }

    // 2FA is mandatory for the admin panel. An admin without it is denied at
    // the door and told to enable it first.
    if (!user.twoFactorEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error:
            "Two-factor authentication is required for admin access. Enable 2FA in your security settings, then try again.",
          code: "ADMIN_2FA_REQUIRED",
        });
    }

    return next();
  } catch (error: any) {
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "SaaS Admin authorization check failed",
      });
  }
}
