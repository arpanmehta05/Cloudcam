import { Router } from "express";
import {
  listFeaturesHandler,
  createFeatureHandler,
  updateFeatureHandler,
} from "./features.controller";

// Mounted under /admin/features; requireSystemAdmin applied by the parent router.
const router = Router();

router.get("/", listFeaturesHandler);
router.post("/", createFeatureHandler);
router.patch("/:key", updateFeatureHandler);

export const featuresRouter = router;
