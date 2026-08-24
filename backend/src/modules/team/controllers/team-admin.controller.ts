// ─── Team Admin Controller: update member, reset password ───
import { Request, Response } from "express";
import { ok, fail } from "../../../shared/responses";
import { updateTeamUser, resetTeamUserPassword } from "../services/team.service";

export async function updateTeamUserHandler(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const targetUserId = String(req.params.userId);
        const user = await updateTeamUser(userId, targetUserId, req.body);
        res.json(ok({ user }));
    } catch (err: any) {
        const status = err.message?.includes("required") || err.message?.includes("characters") ? 400
            : err.message?.includes("not found") ? 404
            : err.message?.includes("authorized") ? 403 : 500;
        res.status(status).json(fail(err));
    }
}

export async function resetTeamUserPasswordHandler(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const targetUserId = String(req.params.userId);
        const user = await resetTeamUserPassword(userId, targetUserId);
        res.json(ok({ user }));
    } catch (err: any) {
        const status = err.message?.includes("not found") ? 404 : err.message?.includes("authorized") ? 403 : 500;
        res.status(status).json(fail(err));
    }
}
