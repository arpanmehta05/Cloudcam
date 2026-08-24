// ─── OTP Module Router ───
import { Router } from "express";
import { sendOtpHandler } from "./controllers/send.controller";
import { verifyOtpHandler } from "./controllers/verify.controller";

const router = Router();

// Public — no auth required (called during signup / login)
router.post("/send", sendOtpHandler);
router.post("/verify", verifyOtpHandler);

export const otpRouter = router;
