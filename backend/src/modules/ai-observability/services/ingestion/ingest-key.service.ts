import crypto from "crypto";
import { AiIngestKey } from "../../../../models/ai-ingest-key.model";
import { ActionRequest } from "../../../../models/action.model";
import { logger } from "../../../../core/logger";
import { recordAudit } from "../audit.service";

const DEFAULT_SCOPES = ["events:write", "traces:write", "scores:write", "reports:write", "prompts:read", "metrics:read"];

export const SUPPORTED_SCOPES = [
  "events:write",
  "traces:write",
  "scores:write",
  "reports:write",
  "datasets:write",
  "prompts:read",
  "metrics:read",
];

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function randomHex(bytes: number): string {
    return crypto.randomBytes(bytes).toString("hex");
}

function normalizeScopes(scopes?: string[]): string[] {
    if (!Array.isArray(scopes) || scopes.length === 0) return DEFAULT_SCOPES;
    const filtered = scopes.filter((scope) => SUPPORTED_SCOPES.includes(scope));
    return filtered.length > 0 ? filtered : DEFAULT_SCOPES;
}

export async function createIngestKey(userId: string, input: { name: string; scopes?: string[]; actorId?: string }) {
    const scopes = normalizeScopes(input.scopes);
    const prefix = `rw_live_${randomHex(2)}`;
    const token = `${prefix}.${randomHex(24)}`;

    const key = await AiIngestKey.create({
        userId,
        name: input.name?.trim() || "AI Observability ingest key",
        prefix,
        keyHash: hashToken(token),
        scopes,
    });

    await recordAudit(
        { userId },
        {
            actorId: input.actorId || userId,
            action: "ingest_key.create",
            resourceType: "ingest_key",
            resourceId: String(key._id),
            resourceName: key.name,
            metadata: { prefix: key.prefix, scopes },
        },
    );

    return {
        id: key._id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        token,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt || null,
        revokedAt: key.revokedAt || null,
    };
}

/**
 * Rotate a key: revoke the existing key and mint a replacement with the same
 * (or overridden) scopes. Returns the new key's plaintext token once.
 */
export async function rotateIngestKey(
    userId: string,
    id: string,
    input: { name?: string; scopes?: string[]; actorId?: string } = {},
) {
    const existing = await AiIngestKey.findOne({ _id: id, userId, revokedAt: null });
    if (!existing) return null;

    const created = await createIngestKey(userId, {
        name: input.name || `${existing.name} (rotated)`,
        scopes: input.scopes || existing.scopes,
        actorId: input.actorId,
    });

    existing.revokedAt = new Date();
    await existing.save();

    await recordAudit(
        { userId },
        {
            actorId: input.actorId || userId,
            action: "ingest_key.rotate",
            resourceType: "ingest_key",
            resourceId: String(existing._id),
            resourceName: existing.name,
            metadata: { replacedBy: String(created.id), prefix: existing.prefix },
        },
    );

    return created;
}

export async function listIngestKeys(userId: string) {
    const keys = await AiIngestKey.find({ userId, revokedAt: null }).sort({ createdAt: -1 }).lean();
    return keys.map((key: any) => ({
        id: key._id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes || [],
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt || null,
        revokedAt: key.revokedAt || null,
    }));
}

export async function revokeIngestKey(userId: string, id: string) {
    const key = await AiIngestKey.findOneAndUpdate(
        { _id: id, userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { returnDocument: "after" }
    );

    if (key) {
        try {
            await ActionRequest.create({
                userId,
                actionId: `revoke-ingest-key-${key._id}`,
                displayName: "Revoke Ingest Key",
                service: "AI Observability",
                targets: [
                    {
                        resourceId: String(key._id),
                        resourceName: key.name || "AI Observability ingest key",
                        region: "global",
                        status: "completed",
                    },
                ],
                status: "completed",
                riskLevel: "low",
                reversible: false,
                estimatedSavings: 0,
                reasoning: `User has revoked the ingest key: ${key.name} (prefix: ${key.prefix})`,
                completedAt: new Date(),
            });
            logger.info(`Audit log added for revoked key: ${key._id}`);
        } catch (err) {
            logger.error(`Failed to create audit log for revoked key: ${err}`);
        }
        await recordAudit(
            { userId },
            {
                actorId: userId,
                action: "ingest_key.revoke",
                resourceType: "ingest_key",
                resourceId: String(key._id),
                resourceName: key.name,
                metadata: { prefix: key.prefix },
            },
        );
    }

    return key;
}

export async function verifyIngestToken(token: string, requiredScope: string) {
    const result = await verifyIngestTokenDetailed(token, requiredScope);
    return result.valid ? result.context : null;
}

export async function verifyIngestTokenDetailed(token: string, requiredScope: string): Promise<
    | { valid: true; context: { userId: string; keyId: string; scopes: string[] } }
    | { valid: false; code: "token_invalid" | "token_revoked" }
> {
    const cleanToken = token.trim();
    if (!cleanToken.startsWith("rw_live_")) return { valid: false, code: "token_invalid" };

    const dot = cleanToken.indexOf(".");
    const prefix = dot > 0 ? cleanToken.slice(0, dot) : cleanToken.slice(0, 12);
    const key = await AiIngestKey.findOne({
        prefix,
        keyHash: hashToken(cleanToken),
    });

    if (!key) return { valid: false, code: "token_invalid" };
    if (key.revokedAt) return { valid: false, code: "token_revoked" };
    if (!key.scopes.includes(requiredScope)) return { valid: false, code: "token_invalid" };

    key.lastUsedAt = new Date();
    await key.save();

    return {
        valid: true,
        context: {
            userId: key.userId,
            keyId: String(key._id),
            scopes: key.scopes,
        },
    };
}
