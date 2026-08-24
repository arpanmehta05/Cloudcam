import { Router } from "express";
import { requireRole } from "../../auth";
import { budgetEnforcePost, budgetGet, budgetPost, budgetPut } from "./budget.controller";

export const budgetRouter = Router();

budgetRouter.get("/budget", budgetGet);
budgetRouter.post("/budget", requireRole(["admin"]), budgetPost);
budgetRouter.put("/budget/:id", requireRole(["admin"]), budgetPut);
budgetRouter.post("/budget/enforce", requireRole(["admin"]), budgetEnforcePost);
