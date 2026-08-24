// OAuth Service — Google & GitHub token exchange and find-or-create user logic
import { config } from "../../../config/env";
import { User, type AuthProvider, encryptKey } from "../../../models/user.model";
import { generateToken, formatUser, type AuthResult } from "../../auth/services";


// ─── Types ──────────────────────────────────────────────────────────────────

interface OAuthProfile {
    email: string;
    name: string;
    providerId: string;
    avatarUrl?: string | null;
    accessToken?: string;
}

interface TokenResponse {
    access_token: string;
    token_type?: string;
    scope?: string;
}

// ─── Google OAuth ───────────────────────────────────────────────────────────

async function exchangeGoogleCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
): Promise<OAuthProfile> {
    if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
        throw new Error("Google OAuth is not configured on the server");
    }
    if (!codeVerifier) {
        throw new Error("Missing PKCE code verifier for Google OAuth");
    }

    // Step 1: Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: config.oauth.google.clientId,
            client_secret: config.oauth.google.clientSecret,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
        }),
    });

    if (!tokenRes.ok) {
        const errorData = await tokenRes.text();
        console.error("[OAuth] Google token exchange failed:", errorData);
        throw new Error("Failed to exchange Google authorization code");
    }

    const tokenData = (await tokenRes.json()) as TokenResponse;

    // Step 2: Fetch user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
        throw new Error("Failed to fetch Google user profile");
    }

    const profile = (await profileRes.json()) as {
        id: string;
        email: string;
        name: string;
        picture?: string;
    };

    if (!profile.email) {
        throw new Error("Google account does not have an email address");
    }

    return {
        email: profile.email,
        name: profile.name || profile.email.split("@")[0],
        providerId: `google:${profile.id}`,
        avatarUrl: profile.picture || null,
        accessToken: tokenData.access_token,
    };
}

// ─── GitHub OAuth ───────────────────────────────────────────────────────────

async function exchangeGitHubCode(code: string, redirectUri: string): Promise<OAuthProfile> {
    if (!config.oauth.github.clientId || !config.oauth.github.clientSecret) {
        throw new Error("GitHub OAuth is not configured on the server for the current environment");
    }

    // Step 1: Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            code,
            client_id: config.oauth.github.clientId,
            client_secret: config.oauth.github.clientSecret,
            redirect_uri: redirectUri,
        }),
    });

    if (!tokenRes.ok) {
        const errorData = await tokenRes.text();
        console.error("[OAuth] GitHub token exchange failed:", errorData);
        throw new Error("Failed to exchange GitHub authorization code");
    }

    const tokenData = (await tokenRes.json()) as TokenResponse & { error?: string; error_description?: string };

    if (tokenData.error) {
        console.error("[OAuth] GitHub token error:", tokenData.error, tokenData.error_description);
        throw new Error(tokenData.error_description || "GitHub authorization failed");
    }

    // Step 2: Fetch user profile
    const profileRes = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: "application/vnd.github+json",
        },
    });

    if (!profileRes.ok) {
        throw new Error("Failed to fetch GitHub user profile");
    }

    const profile = (await profileRes.json()) as {
        id: number;
        login: string;
        name: string | null;
        email: string | null;
        avatar_url?: string;
    };

    // Step 3: If email is null (user has private email), fetch from /user/emails
    let email = profile.email;
    if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/vnd.github+json",
            },
        });

        if (emailsRes.ok) {
            const emails = (await emailsRes.json()) as Array<{
                email: string;
                primary: boolean;
                verified: boolean;
            }>;
            const primaryEmail = emails.find((e) => e.primary && e.verified);
            const verifiedEmail = emails.find((e) => e.verified);
            email = primaryEmail?.email || verifiedEmail?.email || null;
        }
    }

    if (!email) {
        throw new Error(
            "Could not retrieve email from GitHub. Please ensure your GitHub email is verified and not set to private, or use a different sign-in method."
        );
    }

    return {
        email,
        name: profile.name || profile.login,
        providerId: `github:${profile.id}`,
        avatarUrl: profile.avatar_url || null,
        accessToken: tokenData.access_token,
    };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Exchange an OAuth authorization code for a user profile.
 */
export async function exchangeCode(
    provider: AuthProvider,
    code: string,
    redirectUri: string,
    codeVerifier?: string
): Promise<OAuthProfile> {
    switch (provider) {
        case "google":
            return exchangeGoogleCode(code, redirectUri, codeVerifier);
        case "github":
            return exchangeGitHubCode(code, redirectUri);
        default:
            throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
}

/**
 * Find or create a user from an OAuth profile, then issue a JWT.
 *
 * Logic:
 *   1. Look up by providerId → existing OAuth user → issue JWT
 *   2. Look up by email → existing email user → link OAuth, issue JWT
 *   3. No match → create new user with auto-provisioned workspace
 */
export async function oauthLogin(
    provider: AuthProvider,
    profile: OAuthProfile
): Promise<AuthResult> {
    const normalizedEmail = profile.email.toLowerCase().trim();

    // 1. Check if a user exists with this providerId (returning OAuth user)
    let user = await User.findOne({ providerId: profile.providerId });

    if (user) {
        if (user.accountLocked) {
            throw new Error("This account has been permanently deactivated and cannot be accessed.");
        }
        // Update name if it changed on the provider side
        if (profile.name && profile.name !== user.name) {
            user.name = profile.name;
        }
        if (profile.avatarUrl && profile.avatarUrl !== user.avatarUrl) {
            user.avatarUrl = profile.avatarUrl;
        }
        if (provider === "github" && profile.accessToken) {
            user.githubCredentials = {
                accessToken: encryptKey(profile.accessToken),
                connectedAt: new Date(),
            };
        }
        await user.save();
        return { token: generateToken(user), user: formatUser(user) };
    }

    // 2. Check if a user exists with this email (link the OAuth account)
    user = await User.findOne({ email: normalizedEmail });

    if (user) {
        if (user.accountLocked) {
            throw new Error("This account has been permanently deactivated and cannot be accessed.");
        }
        // Link the OAuth provider — keep existing provider, just add providerId
        user.providerId = profile.providerId;
        // Only set provider if user doesn't have a password (pure new OAuth)
        if (!user.passwordHash) {
            user.provider = provider;
        }
        if (profile.avatarUrl) {
            user.avatarUrl = profile.avatarUrl;
        }
        if (provider === "github" && profile.accessToken) {
            user.githubCredentials = {
                accessToken: encryptKey(profile.accessToken),
                connectedAt: new Date(),
            };
        }
        await user.save();
        return { token: generateToken(user), user: formatUser(user) };
    }

    // 3. No existing user — create new account
    user = await User.create({
        email: normalizedEmail,
        name: profile.name,
        provider,
        providerId: profile.providerId,
        avatarUrl: profile.avatarUrl || null,
        passwordHash: null, // OAuth user — no password
        permissionLevel: "admin",
        username: null,
        githubCredentials: provider === "github" && profile.accessToken ? {
            accessToken: encryptKey(profile.accessToken),
            connectedAt: new Date(),
        } : undefined,
    });

    // Auto-provision workspace (same logic as verifySignup)
    const defaultWorkspaceId = user._id.toString();
    user.tenantId = defaultWorkspaceId;
    user.defaultWorkspaceId = defaultWorkspaceId;
    user.workspaces = [defaultWorkspaceId];
    await user.save();

    console.log(`[OAuth] New user created via ${provider}: ${normalizedEmail}`);

    return { token: generateToken(user), user: formatUser(user) };
}
