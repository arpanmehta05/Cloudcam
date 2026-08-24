/**
 * One-time migration script: move VPS log documents from MongoDB to S3 NDJSON storage.
 *
 * Defaults:
 * - Migrates only logs older than 24h (to avoid duplicating current hot data).
 * - Batch size: 500 documents.
 *
 * Usage:
 *   npx tsx scripts/migrate-vps-logs-to-s3.ts
 *   npx tsx scripts/migrate-vps-logs-to-s3.ts --all
 *   npx tsx scripts/migrate-vps-logs-to-s3.ts --dry-run
 *   npx tsx scripts/migrate-vps-logs-to-s3.ts --batch-size=1000
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Readable } from "stream";
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    GetBucketLocationCommand,
} from "@aws-sdk/client-s3";
import { config } from "../src/config/env";
import { VpsLogEntry } from "../src/models/vps-log-entry.model";

type StoredVpsLogEntry = {
    userId: string;
    agentId: string;
    source: "docker" | "pm2" | "system";
    service: string;
    level: "error" | "warn" | "info" | "debug";
    message: string;
    timestamp: string;
    errorSignature?: string;
};

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";
const VPS_LOG_S3_BUCKET = process.env.VPS_LOGS_S3_BUCKET || process.env.RABBITTIZE_VPS_LOGS_BUCKET || "rabbittizevpslogsbucket";
const VPS_LOG_S3_PREFIX = process.env.VPS_LOGS_S3_PREFIX || "vps-logs";
const VPS_LOG_S3_REGION_OVERRIDE = process.env.VPS_LOGS_S3_REGION || process.env.RABBITTIZE_VPS_LOGS_REGION || "ap-southeast-1";

function getAwsClientConfig(region?: string) {
    const hasMasterCreds = !!(config.aws.masterAccessKeyId && config.aws.masterSecretAccessKey);
    return hasMasterCreds
        ? {
            region: region || config.aws.masterRegion || config.aws.region,
            credentials: {
                accessKeyId: config.aws.masterAccessKeyId,
                secretAccessKey: config.aws.masterSecretAccessKey,
            },
        }
        : {
            region: region || config.aws.masterRegion || config.aws.region,
        };
}

function getArgValue(name: string): string | undefined {
    const prefix = `--${name}=`;
    const arg = process.argv.find((a) => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
    return process.argv.includes(`--${name}`);
}

function assertRequiredEnv() {
    if (!VPS_LOG_S3_BUCKET) {
        throw new Error("Missing VPS_LOGS_S3_BUCKET (or RABBITTIZE_VPS_LOGS_BUCKET)");
    }
}

async function resolveBucketRegion(): Promise<string> {
    if (VPS_LOG_S3_REGION_OVERRIDE) {
        return VPS_LOG_S3_REGION_OVERRIDE;
    }

    const probeClient = new S3Client(getAwsClientConfig("us-east-1"));
    try {
        const out = await probeClient.send(
            new GetBucketLocationCommand({ Bucket: VPS_LOG_S3_BUCKET })
        );

        const loc = out.LocationConstraint;
        if (!loc) return "us-east-1";
        if (loc === "EU") return "eu-west-1";
        return loc;
    } catch (error: any) {
        const hintedRegion =
            error?.$metadata?.httpHeaders?.["x-amz-bucket-region"] ||
            error?.BucketRegion ||
            error?.bucketRegion;
        if (hintedRegion) return hintedRegion;
        throw error;
    }
}

function getS3Client(region: string): S3Client {
    return new S3Client(getAwsClientConfig(region));
}

function toDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function buildS3LogKey(userId: string, agentId: string, dayKey: string): string {
    return `${VPS_LOG_S3_PREFIX}/${userId}/${agentId}/${dayKey}.ndjson`;
}

async function streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
}

async function getObjectText(s3: S3Client, key: string): Promise<string> {
    try {
        const result = await s3.send(new GetObjectCommand({ Bucket: VPS_LOG_S3_BUCKET, Key: key }));
        const body = result.Body as Readable | undefined;
        if (!body) return "";
        return streamToString(body);
    } catch (error: any) {
        const code = error?.name || error?.Code || "";
        const message = String(error?.message || "");
        if (code === "NoSuchKey" || code === "NotFound") return "";
        // If ListBucket is denied, S3 may mask missing key as AccessDenied.
        if (code === "AccessDenied" && /ListBucket/i.test(message)) return "";
        throw error;
    }
}

async function putObjectText(s3: S3Client, key: string, text: string): Promise<void> {
    await s3.send(
        new PutObjectCommand({
            Bucket: VPS_LOG_S3_BUCKET,
            Key: key,
            Body: text,
            ContentType: "application/x-ndjson",
        })
    );
}

async function appendEntriesToS3(s3: S3Client, entries: StoredVpsLogEntry[], dryRun: boolean): Promise<number> {
    const byKey = new Map<string, StoredVpsLogEntry[]>();
    for (const entry of entries) {
        const dayKey = toDayKey(new Date(entry.timestamp));
        const key = buildS3LogKey(entry.userId, entry.agentId, dayKey);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(entry);
    }

    let written = 0;
    for (const [key, keyEntries] of byKey) {
        const addition = keyEntries.map((entry) => JSON.stringify(entry)).join("\n");
        if (dryRun) {
            written += keyEntries.length;
            continue;
        }

        const existing = await getObjectText(s3, key);
        const merged = existing ? `${existing.trimEnd()}\n${addition}\n` : `${addition}\n`;
        await putObjectText(s3, key, merged);
        written += keyEntries.length;
    }

    return written;
}

async function main() {
    assertRequiredEnv();

    const dryRun = hasFlag("dry-run");
    const includeAll = hasFlag("all");
    const batchSize = Math.max(1, parseInt(getArgValue("batch-size") || "500", 10));

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const mongoQuery: Record<string, any> = includeAll
        ? {}
        : { timestamp: { $lt: cutoff } };

    console.log("[migrate-vps-logs] Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);

    const totalCandidates = await VpsLogEntry.countDocuments(mongoQuery);
    console.log(
        `[migrate-vps-logs] Found ${totalCandidates} candidate docs` +
        (includeAll ? " (all)" : ` (older than ${cutoff.toISOString()})`)
    );

    if (totalCandidates === 0) {
        await mongoose.disconnect();
        console.log("[migrate-vps-logs] Nothing to migrate.");
        return;
    }

    const bucketRegion = await resolveBucketRegion();
    console.log(`[migrate-vps-logs] Using bucket region: ${bucketRegion}`);
    const s3 = getS3Client(bucketRegion);
    let processed = 0;
    let migrated = 0;

    for (let skip = 0; skip < totalCandidates; skip += batchSize) {
        const docs = await VpsLogEntry.find(mongoQuery)
            .sort({ _id: 1 })
            .skip(skip)
            .limit(batchSize)
            .lean();

        if (!docs.length) break;

        const payload: StoredVpsLogEntry[] = docs.map((doc) => ({
            userId: doc.userId,
            agentId: doc.agentId,
            source: doc.source,
            service: doc.service,
            level: doc.level,
            message: doc.message,
            timestamp: new Date(doc.timestamp).toISOString(),
            errorSignature: doc.errorSignature,
        }));

        const written = await appendEntriesToS3(s3, payload, dryRun);
        processed += docs.length;
        migrated += written;

        console.log(`[migrate-vps-logs] Progress ${processed}/${totalCandidates} docs`);
    }

    await mongoose.disconnect();
    console.log(
        `[migrate-vps-logs] Done. ${dryRun ? "Would migrate" : "Migrated"} ${migrated} docs to s3://${VPS_LOG_S3_BUCKET}/${VPS_LOG_S3_PREFIX}/`
    );
}

main().catch(async (error) => {
    console.error("[migrate-vps-logs] Failed:", error?.message || error);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors
    }
    process.exit(1);
});
