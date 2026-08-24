// ─── Team Members Controller: get, create, delete ───
import { Request, Response } from "express";
import { ok, fail } from "../../../shared/responses";
import { getTeamMembers, createTeamUser, deleteTeamUser } from "../services/team.service";

export async function getTeamHandler(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const members = await getTeamMembers(userId);
        res.json(ok({ members }));
    } catch (err: any) {
        res.status(err.status || 500).json(fail(err));
    }
}

export async function createTeamUserHandler(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const user = await createTeamUser(userId, req.body);
        res.json(ok({ user }));
    } catch (err: any) {
        const status = err.message?.includes("required") || err.message?.includes("taken") ? 400 : 500;
        res.status(status).json(fail(err));
    }
}

export async function deleteTeamUserHandler(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const targetUserId = String(req.params.userId);
        const result = await deleteTeamUser(userId, targetUserId);
        res.json(ok(result));
    } catch (err: any) {
        const status = err.message?.includes("not found") ? 404 : err.message?.includes("authorized") ? 403 : 400;
        res.status(status).json(fail(err));
    }
}
