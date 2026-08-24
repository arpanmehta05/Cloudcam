import { randomBytes } from "crypto";
import { Readable } from "stream";
import { gzipSync, gunzipSync } from "zlib";
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { config } from "../../../config/env";
import { logger } from "../../../core/logger";

export const VPS_LOG_S3_BUCKET = process.env.VPS_LOGS_S3_BUCKET || process.env.RABBITTIZE_VPS_LOGS_BUCKET || "";
export const VPS_LOG_S3_PREFIX = process.env.VPS_LOGS_S3_PREFIX || "vps-logs";
export const VPS_LOGS_S3_COMPRESS = /^(1|true|yes)$/i.test(process.env.VPS_LOGS_S3_COMPRESS || "true");

function getS3Client(): S3Client {
    const hasMasterCreds = !!(config.aws.masterAccessKeyId && config.aws.masterSecretAccessKey);
    const region = process.env.VPS_LOGS_S3_REGION || config.aws.masterRegion || config.aws.region;
    return new S3Client(
        hasMasterCreds
            ? {
                region: region,
                credentials: {
                    accessKeyId: config.aws.masterAccessKeyId!,
                    secretAccessKey: config.aws.masterSecretAccessKey!,
                },
            }
            : {
                region: region,
            }
    );
}

export function assertS3BucketConfigured() {
    if (!VPS_LOG_S3_BUCKET) {
        throw new Error("VPS_LOGS_S3_BUCKET not configured");
    }
}

export function buildS3LogChunkKey(userId: string, agentId: string, dayKey: string): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const nonce = randomBytes(4).toString("hex");
    const suffix = VPS_LOGS_S3_COMPRESS ? ".ndjson.gz" : ".ndjson";
    return `${VPS_LOG_S3_PREFIX}/${userId}/${agentId}/${dayKey}/${stamp}-${nonce}${suffix}`;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseS3LogKey(key: string, userId: string): { agentId: string; dayKey: string } | null {
    const escapedPrefix = escapeRegExp(VPS_LOG_S3_PREFIX);
    const escapedUserId = escapeRegExp(userId);

    const chunked = key.match(new RegExp(`^${escapedPrefix}/${escapedUserId}/([^/]+)/([0-9]{4}-[0-9]{2}-[0-9]{2})/[^/]+\\.ndjson(?:\\.gz)?$`));
    if (chunked) {
        return { agentId: chunked[1], dayKey: chunked[2] };
    }

    const legacy = key.match(new RegExp(`^${escapedPrefix}/${escapedUserId}/([^/]+)/([0-9]{4}-[0-9]{2}-[0-9]{2})\\.ndjson(?:\\.gz)?$`));
    if (legacy) {
        return { agentId: legacy[1], dayKey: legacy[2] };
    }

    return null;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export async function getObjectText(key: string): Promise<string> {
    try {
        const s3 = getS3Client();
        const result = await s3.send(new GetObjectCommand({ Bucket: VPS_LOG_S3_BUCKET, Key: key }));
        const body = result.Body as Readable | undefined;
        if (!body) return "";
        const raw = await streamToBuffer(body);
        if (!raw.length) return "";

        const encoding = String(result.ContentEncoding || "").toLowerCase();
        const isGzip = encoding.includes("gzip") || key.endsWith(".gz");
        if (!isGzip) return raw.toString("utf8");

        try {
            return gunzipSync(raw).toString("utf8");
        } catch {
            return raw.toString("utf8");
        }
    } catch (error: any) {
        const code = error?.name || error?.Code || "";
        if (code === "NoSuchKey" || code === "NotFound") return "";
        throw error;
    }
}

export async function putObjectText(key: string, text: string) {
    const s3 = getS3Client();
    const raw = Buffer.from(text, "utf8");
    const body = VPS_LOGS_S3_COMPRESS ? gzipSync(raw) : raw;

    await s3.send(
        new PutObjectCommand({
            Bucket: VPS_LOG_S3_BUCKET,
            Key: key,
            Body: body,
            ContentType: "application/x-ndjson",
            ContentEncoding: VPS_LOGS_S3_COMPRESS ? "gzip" : undefined,
        })
    );
}

export async function deleteS3Keys(keys: string[]): Promise<number> {
    if (!keys.length) return 0;
    const s3 = getS3Client();
    let deleted = 0;
    for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
        if (!batch.length) continue;
        await s3.send(
            new DeleteObjectsCommand({
                Bucket: VPS_LOG_S3_BUCKET,
                Delete: { Objects: batch },
            })
        );
        deleted += batch.length;
    }
    return deleted;
}

export async function listUserLogKeysFromS3(userId: string, agentId?: string): Promise<string[]> {
    try {
        assertS3BucketConfigured();
        const s3 = getS3Client();
        const prefix = agentId ? `${VPS_LOG_S3_PREFIX}/${userId}/${agentId}/` : `${VPS_LOG_S3_PREFIX}/${userId}/`;
        const keys: string[] = [];
        let continuationToken: string | undefined;

        do {
            const page = await s3.send(
                new ListObjectsV2Command({
                    Bucket: VPS_LOG_S3_BUCKET,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                    MaxKeys: 1000,
                })
            );

            for (const item of page.Contents || []) {
                if (item.Key) keys.push(item.Key);
            }
            continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (continuationToken);

        return keys;
    } catch (e: any) {
        if (e.name === 'NoSuchBucket' || (e.message && (e.message.includes('bucket does not exist') || e.message.includes('not configured')))) {
            logger.warn(`S3 bucket ${VPS_LOG_S3_BUCKET || 'not configured'} not found, returning empty key list for ${userId}`);
            return [];
        }
        throw e;
    }
}
