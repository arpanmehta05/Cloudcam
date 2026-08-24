import mongoose from "mongoose";
import { config } from "../config";
import { migrateAiDailyMetricIndexes } from "../../config/ai-daily-metric-index-migration";

/**
 * Initializes and connects to the MongoDB database.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log("✅ Connected to MongoDB");

    // Automatically drop legacy non-partial email index if it exists
    try {
      const db = mongoose.connection.db;
      if (db) {
        const collections = await db
          .listCollections({ name: "users" })
          .toArray();
        if (collections.length > 0) {
          const indexes = await db.collection("users").indexes();
          const emailIndex = indexes.find((idx) => idx.name === "email_1");
          if (emailIndex && !emailIndex.partialFilterExpression) {
            console.log(
              "⚠️ Legacy global unique email index found. Dropping to apply new partial index...",
            );
            await db.collection("users").dropIndex("email_1");
            console.log("✅ Legacy index dropped successfully.");
          }
        }
      }
    } catch (indexErr: any) {
      console.warn(
        "⚠️ Warning: Could not verify/drop legacy unique email index:",
        indexErr.message,
      );
    }

    // Automatically drop legacy TTL index on scheduledDeletionAt (soft-lock migration)
    try {
      const db = mongoose.connection.db;
      if (db) {
        const collections = await db
          .listCollections({ name: "users" })
          .toArray();
        if (collections.length > 0) {
          const indexes = await db.collection("users").indexes();
          const ttlIndex = indexes.find(
            (idx) =>
              idx.name === "scheduledDeletionAt_1" &&
              idx.expireAfterSeconds !== undefined,
          );
          if (ttlIndex) {
            console.log(
              "⚠️ Legacy TTL index on scheduledDeletionAt found. Dropping (accounts are now soft-locked)...",
            );
            await db.collection("users").dropIndex("scheduledDeletionAt_1");
            console.log("✅ Legacy TTL index dropped successfully.");
          }
        }
      }
    } catch (ttlErr: any) {
      console.warn(
        "⚠️ Warning: Could not verify/drop legacy TTL index:",
        ttlErr.message,
      );
    }
    try {
      const db = mongoose.connection.db;
      if (db) {
        await migrateAiDailyMetricIndexes(db);
      }
    } catch (metricIndexErr: any) {
      console.warn(
        "[database] Could not migrate AI daily metric indexes:",
        metricIndexErr.message,
      );
    }
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

/**
 * Returns the active Mongoose database connection.
 */
export function getConnection(): mongoose.Connection {
  return mongoose.connection;
}
