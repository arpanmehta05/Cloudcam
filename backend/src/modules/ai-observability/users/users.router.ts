import { Router } from "express";
import { endUserDetailGet, endUsersGet } from "./users.controller";

const router = Router();

router.get("/users", endUsersGet);
router.get("/users/:endUserId", endUserDetailGet);

export default router;
