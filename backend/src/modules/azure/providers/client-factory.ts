// Azure Client Factory — token caching for Microsoft OAuth
// Canonical location: modules/azure/providers/client-factory.ts
import axios from "axios";

interface TokenCacheEntry {
    token: string;
    expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

/**
 * Exchanges Client Credentials (Tenant ID, Client ID, Client Secret) for an access token
 * from the Microsoft OAuth endpoint, caching the result to avoid unnecessary requests.
 */
export async function getAzureAccessToken(
    tenantId: string,
    clientId: string,
    clientSecret: string
): Promise<string> {
    const key = `${tenantId}:${clientId}:${clientSecret}`;
    const cached = tokenCache.get(key);

    // Check if token exists and is valid for at least another 5 minutes (300,000 ms)
    if (cached && cached.expiresAt > Date.now() + 300000) {
        return cached.token;
    }

    try {
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", clientId);
        params.append("client_secret", clientSecret);
        params.append("scope", "https://management.azure.com/.default");

        const tokenRes = await axios.post(tokenUrl, params, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 10000,
        });

        const accessToken = tokenRes.data.access_token;
        const expiresIn = tokenRes.data.expires_in || 3600; // in seconds

        if (!accessToken) {
            throw new Error("No access_token returned in Microsoft OAuth response");
        }

        tokenCache.set(key, {
            token: accessToken,
            expiresAt: Date.now() + expiresIn * 1000,
        });

        return accessToken;
    } catch (error: any) {
        console.error("[getAzureAccessToken] Failed to fetch access token:", error?.response?.data || error.message);
        throw new Error(`Azure authentication failed: ${error.message}`);
    }
}
