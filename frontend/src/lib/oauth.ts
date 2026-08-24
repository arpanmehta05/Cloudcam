// OAuth utility — builds provider URLs, handles PKCE, manages state
// This file runs in the browser only.

type OAuthProvider = "google" | "github";

interface ProviderConfig {
    authUrl: string;
    getClientId: () => { value: string; source: string };
    scopes: string;
    supportsPkce: boolean;
}

function getAppEnvironment(): "development" | "production" {
    const raw = (process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development")
        .toLowerCase()
        .trim();
    return raw === "production" ? "production" : "development";
}

function getGoogleClientId(): { value: string; source: string } {
    return {
        value: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || "",
        source: "NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID",
    };
}

function getGitHubClientId(): { value: string; source: string } {
    const appEnv = getAppEnvironment();

    if (appEnv === "production") {
        return {
            value:
                process.env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID_PRODUCTION ||
                process.env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID ||
                "",
            source:
                process.env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID_PRODUCTION
                    ? "NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID_PRODUCTION"
                    : "NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID",
        };
    }

    return {
        value:
            process.env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID_DEVELOPMENT ||
            process.env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID ||
            "",
        source:
            process.env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID_DEVELOPMENT
                ? "NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID_DEVELOPMENT"
                : "NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID",
    };
}

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
    google: {
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        getClientId: getGoogleClientId,
        scopes: "openid email profile",
        supportsPkce: true,
    },
    github: {
        authUrl: "https://github.com/login/oauth/authorize",
        getClientId: getGitHubClientId,
        scopes: "repo read:user user:email",
        supportsPkce: false, // GitHub OAuth Apps don't support PKCE
    },
};

// ─── PKCE Helpers ──────────────────────────────────────────────────────────

function generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateCodeVerifier(): string {
    // 32 bytes → 64 hex chars, well within the 43-128 char PKCE requirement
    return generateRandomString(32);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    // Convert to base64url
    const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Session Storage Keys ───────────────────────────────────────────────────

const STORAGE_KEYS = {
    state: "oauth_state",
    codeVerifier: "oauth_code_verifier",
} as const;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initiates the OAuth flow by redirecting to the provider's consent screen.
 * Stores state and PKCE verifier in sessionStorage for the callback page.
 */
export async function startOAuthFlow(provider: OAuthProvider): Promise<void> {
    const config = PROVIDERS[provider];
    if (!config) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    const { value: clientId, source } = config.getClientId();
    if (!clientId) {
        throw new Error(
            `OAuth client ID not configured. Set ${source} in your environment.`
        );
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;

    // Generate state token for CSRF protection — prefixed with provider name
    const stateRandom = generateRandomString(16);
    const state = `${provider}:${stateRandom}`;

    // Store state for validation on callback
    sessionStorage.setItem(STORAGE_KEYS.state, state);

    // Build authorization URL
    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: config.scopes,
        state,
    });

    // Add PKCE if supported
    if (config.supportsPkce) {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
        params.set("code_challenge", codeChallenge);
        params.set("code_challenge_method", "S256");
    }

    // Google-specific: prompt for account selection
    if (provider === "google") {
        params.set("access_type", "offline");
        params.set("prompt", "select_account");
    }

    // Redirect to provider
    window.location.href = `${config.authUrl}?${params.toString()}`;
}

/**
 * Extracts and validates OAuth callback parameters from the URL.
 * Called by the callback page on mount.
 */
export function extractCallbackParams(searchParams: URLSearchParams): {
    provider: OAuthProvider;
    code: string;
    codeVerifier: string | null;
    redirectUri: string;
} | { error: string } {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    // Provider denied access or user cancelled
    if (errorParam) {
        return {
            error: errorParam === "access_denied"
                ? "Authentication was cancelled."
                : `OAuth error: ${errorParam}`,
        };
    }

    if (!code) {
        return { error: "No authorization code received." };
    }

    if (!state) {
        return { error: "Missing state parameter — possible CSRF attack." };
    }

    // Validate state matches what we stored
    const storedState = sessionStorage.getItem(STORAGE_KEYS.state);
    if (!storedState || storedState !== state) {
        return { error: "State mismatch — possible CSRF attack. Please try again." };
    }

    // Extract provider from state prefix
    const [provider] = state.split(":") as [OAuthProvider];
    if (!PROVIDERS[provider]) {
        return { error: `Unknown provider in state: ${provider}` };
    }

    // Get code verifier if PKCE was used
    const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);

    // Clean up session storage
    sessionStorage.removeItem(STORAGE_KEYS.state);
    sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);

    return {
        provider,
        code,
        codeVerifier,
        redirectUri: `${window.location.origin}/oauth/callback`,
    };
}
