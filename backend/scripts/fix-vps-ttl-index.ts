import dotenv from "dotenv";
import mongoose from "mongoose";
import { VpsLogEntry } from "../src/models/vps-log-entry.model";

dotenv.config();

const EXPECTED_TTL_SECONDS = 24 * 60 * 60;

async function ensureTimestampTtlIndex() {
  const indexes = await VpsLogEntry.collection.indexes();

  const timestampIndexes = indexes.filter((idx) => {
    const keys = Object.keys(idx.key || {});
    return keys.length === 1 && idx.key.timestamp === 1;
  });

  // Drop non-TTL or mismatched TTL timestamp indexes.
  for (const idx of timestampIndexes) {
    const currentTtl = (idx as any).expireAfterSeconds;
    if (currentTtl !== EXPECTED_TTL_SECONDS) {
      console.log(
        `[fix-vps-ttl-index] Dropping index ${idx.name} (expireAfterSeconds=${currentTtl ?? "none"})`
      );
      await VpsLogEntry.collection.dropIndex(idx.name);
    }
  }

  // Ensure correct TTL index exists.
  await VpsLogEntry.collection.createIndex(
    { timestamp: 1 },
    { expireAfterSeconds: EXPECTED_TTL_SECONDS, name: "timestamp_1" }
  );

  const after = await VpsLogEntry.collection.indexes();
  const ttlIndex = after.find((idx) => idx.name === "timestamp_1");
  console.log("[fix-vps-ttl-index] Final timestamp_1 index:");
  console.log(JSON.stringify(ttlIndex, null, 2));
}

async function main() {
  const uri = process.env.MONGODB_URI || "";
  if (!uri) {
    throw new Error("MONGODB_URI missing");
  }

  await mongoose.connect(uri);
  await ensureTimestampTtlIndex();
  await mongoose.disconnect();
  console.log("[fix-vps-ttl-index] Completed.");
}

main().catch(async (error) => {
  console.error("[fix-vps-ttl-index] Failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
