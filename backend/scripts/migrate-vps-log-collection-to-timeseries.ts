import dotenv from "dotenv";
import mongoose from "mongoose";
import { VpsLogEntry } from "../src/models/vps-log-entry.model";

dotenv.config();

const BATCH_SIZE = Math.max(100, parseInt(process.env.VPS_LOG_TS_MIGRATION_BATCH_SIZE || "1000", 10));

async function main() {
    const uri = process.env.MONGODB_URI || "";
    if (!uri) {
        throw new Error("MONGODB_URI missing");
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) {
        throw new Error("Mongo database connection unavailable");
    }

    const collectionName = VpsLogEntry.collection.name;
    const tempCollectionName = `${collectionName}_timeseries_tmp`;
    const backupCollectionName = `${collectionName}_pre_timeseries_${new Date().toISOString().replace(/[:.]/g, "-")}`;

    const existing = await db.listCollections({ name: collectionName }).next();
    if (!existing) {
        await db.createCollection(collectionName, {
            timeseries: {
                timeField: "timestamp",
                metaField: "metadata",
                granularity: "minutes",
            },
            expireAfterSeconds: 24 * 60 * 60,
        });
        console.log(`[vps-log-timeseries] Created ${collectionName} as a time-series collection.`);
        return;
    }

    if (existing.options?.timeseries) {
        console.log(`[vps-log-timeseries] ${collectionName} is already a time-series collection.`);
        return;
    }

    const tempExisting = await db.listCollections({ name: tempCollectionName }).next();
    if (tempExisting) {
        await db.dropCollection(tempCollectionName);
    }

    await db.createCollection(tempCollectionName, {
        timeseries: {
            timeField: "timestamp",
            metaField: "metadata",
            granularity: "minutes",
        },
        expireAfterSeconds: 24 * 60 * 60,
    });

    const source = db.collection(collectionName);
    const target = db.collection(tempCollectionName);
    const cursor = source.find({}).sort({ timestamp: 1 });
    let batch: any[] = [];
    let copied = 0;

    for await (const doc of cursor) {
        delete doc._id;
        doc.metadata = {
            ...(doc.metadata || {}),
            userId: doc.userId,
            agentId: doc.agentId,
            source: doc.source,
            service: doc.service,
            level: doc.level,
            errorSignature: doc.errorSignature || "",
        };
        batch.push(doc);

        if (batch.length >= BATCH_SIZE) {
            await target.insertMany(batch, { ordered: false });
            copied += batch.length;
            batch = [];
            console.log(`[vps-log-timeseries] Copied ${copied} documents...`);
        }
    }

    if (batch.length) {
        await target.insertMany(batch, { ordered: false });
        copied += batch.length;
    }

    await source.rename(backupCollectionName);
    await target.rename(collectionName);

    await VpsLogEntry.collection.createIndex({ userId: 1, timestamp: -1 });
    await VpsLogEntry.collection.createIndex({ userId: 1, level: 1, timestamp: -1 });
    await VpsLogEntry.collection.createIndex({ userId: 1, errorSignature: 1, timestamp: -1 });
    await VpsLogEntry.collection.createIndex({ archivedToS3At: 1, timestamp: 1 });

    console.log(`[vps-log-timeseries] Migrated ${copied} documents.`);
    console.log(`[vps-log-timeseries] Original collection renamed to ${backupCollectionName}.`);
}

main().catch(async (error) => {
    console.error("[vps-log-timeseries] Failed:", error);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
}).finally(async () => {
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
});
