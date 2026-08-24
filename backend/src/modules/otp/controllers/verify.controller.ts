// ─── OTP Verify Controller ───
import { Request, Response } from "express";
import { logger } from "../../../core/logger";
import { verifyOtp } from "../../../services/otp.service";

const VALID_PURPOSES = ["email-verify", "password-reset", "login-2fa"] as const;
type OtpPurpose = (typeof VALID_PURPOSES)[number];

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
    try {
        const { email, code, purpose = "email-verify" } = req.body as {
            email?: string;
            code?: string;
            purpose?: string;
        };

        if (!email || typeof email !== "string") {
            res.status(400).json({ success: false, valid: false, error: "email is required.", message: "email is required." });
            return;
        }

        if (!code || typeof code !== "string") {
            res.status(400).json({ success: false, valid: false, error: "code is required.", message: "code is required." });
            return;
        }

        const sanitizedCode = code.trim().replace(/\D/g, "");
        if (sanitizedCode.length !== 6) {
            res.status(400).json({ success: false, valid: false, error: "OTP must be exactly 6 digits.", message: "OTP must be exactly 6 digits." });
            return;
        }

        if (!VALID_PURPOSES.includes(purpose as OtpPurpose)) {
            res.status(400).json({
                success: false,
                valid: false,
                error: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(", ")}`,
                message: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(", ")}`,
            });
            return;
        }

        const result = await verifyOtp(email.trim(), sanitizedCode, purpose);
        const statusCode = result.valid ? 200 : 400;
        res.status(statusCode).json({
            success: result.valid,
            ...result,
            error: result.valid ? undefined : result.message,
        });
    } catch (err: any) {
        logger.error("[OTP] verifyOtpHandler error", { error: err?.message });
        res.status(500).json({ success: false, valid: false, error: "Internal server error.", message: "Internal server error." });
    }
}
