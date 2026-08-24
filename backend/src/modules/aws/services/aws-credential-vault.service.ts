import crypto from "crypto";
import { AwsCredentialVaultModel } from "../models/aws-credential-vault.model";
import { config } from "../../../config/env";

const ENC_KEY = crypto
  .createHash("sha256")
  .update(process.env.AWS_CREDENTIAL_VAULT_KEY || config.jwtSecret)
  .digest();

type AwsCredentialInput = {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  defaultRegion?: string;
};

export type ResolvedAwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region?: string;
};

function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value: string): string {
  const [ivB64, tagB64, encryptedB64] = value.split(":");
  if (!ivB64 || !tagB64 || !encryptedB64) throw new Error("Stored credential is corrupted");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function sanitizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function listVaultCredentials(userId: string) {
  const rows = await AwsCredentialVaultModel.find({ userId })
    .select("name accessKeyIdLast4 defaultRegion hasSessionToken lastUsedAt createdAt updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  return rows.map((row: any) => ({
    id: String(row._id),
    name: row.name,
    accessKeyIdLast4: row.accessKeyIdLast4,
    defaultRegion: row.defaultRegion || "",
    hasSessionToken: !!row.hasSessionToken,
    lastUsedAt: row.lastUsedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function saveVaultCredential(userId: string, input: AwsCredentialInput) {
  const name = sanitizeName(input.name);
  const accessKeyId = input.accessKeyId.trim();
  const secretAccessKey = input.secretAccessKey.trim();
  const sessionToken = (input.sessionToken || "").trim();
  const defaultRegion = (input.defaultRegion || "").trim();

  if (!name) throw new Error("Credential name is required");
  if (!accessKeyId || !secretAccessKey) throw new Error("Access key ID and secret access key are required");

  const row = await AwsCredentialVaultModel.findOneAndUpdate(
    { userId, name },
    {
      $set: {
        userId,
        name,
        accessKeyIdLast4: accessKeyId.slice(-4),
        defaultRegion: defaultRegion || null,
        hasSessionToken: sessionToken.length > 0,
        encryptedAccessKeyId: encryptSecret(accessKeyId),
        encryptedSecretAccessKey: encryptSecret(secretAccessKey),
        encryptedSessionToken: sessionToken ? encryptSecret(sessionToken) : null,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return {
    id: String(row._id),
    name: row.name,
    accessKeyIdLast4: row.accessKeyIdLast4,
    defaultRegion: row.defaultRegion || "",
    hasSessionToken: row.hasSessionToken,
    lastUsedAt: row.lastUsedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function deleteVaultCredential(userId: string, credentialId: string) {
  const result = await AwsCredentialVaultModel.findOneAndDelete({ _id: credentialId, userId });
  return !!result;
}

export async function resolveVaultCredential(userId: string, credentialId: string): Promise<ResolvedAwsCredentials> {
  const row = await AwsCredentialVaultModel.findOne({ _id: credentialId, userId });
  if (!row) throw new Error("Saved credential was not found");

  row.lastUsedAt = new Date();
  await row.save();

  return {
    accessKeyId: decryptSecret(row.encryptedAccessKeyId),
    secretAccessKey: decryptSecret(row.encryptedSecretAccessKey),
    sessionToken: row.encryptedSessionToken ? decryptSecret(row.encryptedSessionToken) : "",
    region: row.defaultRegion || undefined,
  };
}

export async function resolveCredentialPayload(
  userId: string,
  body: any
): Promise<ResolvedAwsCredentials> {
  const credentialVaultId = typeof body?.credentialVaultId === "string" ? body.credentialVaultId.trim() : "";
  if (credentialVaultId) {
    if (body?.userPresenceVerified !== true) {
      throw new Error("Unlock this saved key with your device passkey before using it");
    }
    const resolved = await resolveVaultCredential(userId, credentialVaultId);
    return {
      ...resolved,
      region: body?.region || resolved.region,
    };
  }

  const accessKeyId = String(body?.accessKeyId || "").trim();
  const secretAccessKey = String(body?.secretAccessKey || "").trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("accessKeyId and secretAccessKey are required");
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: String(body?.sessionToken || ""),
    region: body?.region,
  };
}
