// ─── OAuth Callback Controller ───
import { Request, Response } from "express";
import { logger } from "../../../core/logger";
import { exchangeCode, oauthLogin } from "../../../services/oauth.service";
import { recordLoginEvent } from "../../../services/auth.service";
import type { AuthProvider } from "../../../models/user.model";

const VALID_PROVIDERS: AuthProvider[] = ["google", "github"];

export async function oauthCallbackHandler(req: Request, res: Response): Promise<void> {
    try {
        const { provider, code, redirectUri, codeVerifier, code_verifier } = req.body as {
            provider?: string;
            code?: string;
            redirectUri?: string;
            codeVerifier?: string;
            code_verifier?: string;
        };

        const resolvedCodeVerifier = codeVerifier || code_verifier;

        if (!provider || !VALID_PROVIDERS.includes(provider as AuthProvider)) {
            res.status(400).json({ success: false, error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` });
            return;
        }

        if (!code || typeof code !== "string") {
            res.status(400).json({ success: false, error: "Authorization code is required" });
            return;
        }

        if (!redirectUri || typeof redirectUri !== "string") {
            res.status(400).json({ success: false, error: "Redirect URI is required" });
            return;
        }

        if (provider === "google" && (!resolvedCodeVerifier || typeof resolvedCodeVerifier !== "string")) {
            res.status(400).json({ success: false, error: "Code verifier is required for Google OAuth" });
            return;
        }

        const profile = await exchangeCode(provider as AuthProvider, code, redirectUri, resolvedCodeVerifier);
        const result = await oauthLogin(provider as AuthProvider, profile);

        const ip = req.ip || String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
        const userAgent = req.headers["user-agent"] || "";
        await recordLoginEvent(result.user.id, provider, ip, userAgent);

        res.json({ success: true, token: result.token, user: result.user });
    } catch (error: any) {
        logger.error("[OAuth] Callback error", { error: error.message });
        res.status(400).json({ success: false, error: error.message || "OAuth authentication failed" });
    }
}
