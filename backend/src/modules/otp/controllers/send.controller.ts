// ─── OTP Send Controller ───
import { Request, Response } from "express";
import { logger } from "../../../core/logger";
import { sendOtp } from "../../../services/otp.service";

const VALID_PURPOSES = ["email-verify", "password-reset", "login-2fa"] as const;
type OtpPurpose = (typeof VALID_PURPOSES)[number];

export async function sendOtpHandler(req: Request, res: Response): Promise<void> {
    try {
        const { email, purpose = "email-verify" } = req.body as { email?: string; purpose?: string };

        if (!email || typeof email !== "string") {
            res.status(400).json({ success: false, error: "email is required.", message: "email is required." });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            res.status(400).json({ success: false, error: "Invalid email address.", message: "Invalid email address." });
            return;
        }

        if (!VALID_PURPOSES.includes(purpose as OtpPurpose)) {
            res.status(400).json({
                success: false,
                error: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(", ")}`,
                message: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(", ")}`,
            });
            return;
        }

        const result = await sendOtp(email.trim(), purpose);

        if (!result.success) {
            res.status(429).json({ ...result, error: result.message });
            return;
        }

        res.status(200).json(result);
    } catch (err: any) {
        logger.error("[OTP] sendOtpHandler error", { error: err?.message });
        res.status(500).json({
            success: false,
            error: "Failed to send OTP. Please try again later.",
            message: "Failed to send OTP. Please try again later.",
        });
    }
}
