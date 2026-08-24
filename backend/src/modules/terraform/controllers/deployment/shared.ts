import type { Request } from "express";

export function getUserId(req: Request): string | null {
  return (req as any).user?.userId || null;
}

export function getParam(req: Request, name: string): string {
  return String(req.params[name]);
}
