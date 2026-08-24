// OTP Service — generate, store, and verify 6-digit one-time passwords
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Otp } from "../../../models/otp.model";
import { sendOtpEmail } from "../../../services/email.service";
import { User } from "../../../models/user.model";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINS = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECS = 60; // prevent spam — must wait 60 s before requesting a new OTP

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
function generateOtp(): string {
    // Use crypto for secure randomness; modulo 1_000_000 → always 6 digits
    const randomNum = crypto.randomInt(0, 1_000_000);
    return randomNum.toString().padStart(OTP_LENGTH, "0");
}

// ── Send OTP ──────────────────────────────────────────────────────────────────

export interface SendOtpResult {
    success: boolean;
    message: string;
    resendAfterSecs?: number;
}

/**
 * Generates a new OTP, stores a bcrypt hash in MongoDB, and sends the code by email.
 * Enforces a per-email+purpose cooldown to prevent spam.
 *
 * @param email   Recipient's email address
 * @param purpose Identifies the flow: "email-verify" | "password-reset" | "login-2fa"
 */
export async function sendOtp(email: string, purpose: string = "email-verify", displayName?: string): Promise<SendOtpResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // ── Cooldown check ──────────────────────────────────────────────────────
    const existing = await Otp.findOne({ email: normalizedEmail, purpose })
        .sort({ createdAt: -1 })
        .lean();

    if (existing) {
        const secondsSinceCreated = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
        if (secondsSinceCreated < RESEND_COOLDOWN_SECS) {
            const remaining = Math.ceil(RESEND_COOLDOWN_SECS - secondsSinceCreated);
            return {
                success: false,
                message: `Please wait ${remaining} seconds before requesting a new code.`,
                resendAfterSecs: remaining,
            };
        }
    }

    // ── Look up user name for personalised email ────────────────────────────
    const user = await User.findOne({ email: normalizedEmail }).lean();
    const name = displayName || user?.name;

    // ── Generate & hash ─────────────────────────────────────────────────────
    const otp = generateOtp();
    console.log(`[OTP] Generated 6-digit code for ${normalizedEmail}: ${otp}`);
    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60 * 1000);

    // ── Delete old OTPs for this email+purpose ───────────────────────────────
    await Otp.deleteMany({ email: normalizedEmail, purpose });

    // ── Persist ──────────────────────────────────────────────────────────────
    const record = await Otp.create({ email: normalizedEmail, otpHash, purpose, expiresAt });

    // ── Send email ───────────────────────────────────────────────────────────
    try {
        await sendOtpEmail({
            to: normalizedEmail,
            name,
            otp,
            purpose,
            expiryMins: OTP_EXPIRY_MINS,
        });
    } catch (error) {
        if (process.env.APP_ENV === "development" || process.env.NODE_ENV !== "production") {
            console.warn(`[OTP] SMTP send failed: ${error instanceof Error ? error.message : String(error)}. Proceeding in development mode with generated code: ${otp}`);
        } else {
            await record.deleteOne();
            throw error;
        }
    }

    return { success: true, message: "OTP sent successfully. Check your inbox." };
}

// ── Verify OTP ────────────────────────────────────────────────────────────────

export interface VerifyOtpResult {
    valid: boolean;
    message: string;
}

/**
 * Verifies a submitted OTP against the stored hash.
 * Invalidates (deletes) the OTP on success or after MAX_ATTEMPTS failures.
 *
 * @param email   Email to look up
 * @param code    The 6-digit code submitted by the user
 * @param purpose The same purpose used when sending
 */
export async function verifyOtp(
    email: string,
    code: string,
    purpose: string = "email-verify"
): Promise<VerifyOtpResult> {
    const normalizedEmail = email.toLowerCase().trim();

    const record = await Otp.findOne({ email: normalizedEmail, purpose }).sort({ createdAt: -1 });

    if (!record) {
        return { valid: false, message: "No OTP found. Please request a new code." };
    }

    // ── Expiry ───────────────────────────────────────────────────────────────
    if (new Date() > record.expiresAt) {
        await record.deleteOne();
        return { valid: false, message: "OTP has expired. Please request a new code." };
    }

    // ── Attempt limit ────────────────────────────────────────────────────────
    if (record.attempts >= MAX_ATTEMPTS) {
        await record.deleteOne();
        return { valid: false, message: "Too many failed attempts. Please request a new code." };
    }

    // ── Compare ──────────────────────────────────────────────────────────────
    const isMatch = await bcrypt.compare(code, record.otpHash);

    if (!isMatch) {
        record.attempts += 1;
        await record.save();
        const remaining = MAX_ATTEMPTS - record.attempts;
        return {
            valid: false,
            message: remaining > 0
                ? `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
                : "Too many failed attempts. Please request a new code.",
        };
    }

    // ── Success — consume the OTP ────────────────────────────────────────────
    await record.deleteOne();
    return { valid: true, message: "OTP verified successfully." };
}
