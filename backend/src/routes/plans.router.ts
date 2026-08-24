import { Router } from "express";
import { Plan } from "../models/plan.model";
import { Feature } from "../models/feature.model";
import { authMiddleware } from "../modules/auth";
import { assignPlan } from "../modules/admin/tenants/tenants.service";
import { User } from "../models/user.model";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [plans, features] = await Promise.all([
      Plan.find({ isActive: true, isPublic: true }).sort({ price: 1 }).lean(),
      Feature.find({ isActive: true }).select("key name description group").lean(),
    ]);
    res.json({ success: true, plans, features });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/subscribe", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    const { planKey } = req.body;
    if (!planKey) {
      return res.status(400).json({ success: false, error: "Plan key is required" });
    }

    const user = await User.findById(userId).select("tenantId");
    const tenantId = user?.tenantId || userId;

    const subscription = await assignPlan(tenantId, planKey);
    res.json({ success: true, subscription });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export const publicPlansRouter = router;

