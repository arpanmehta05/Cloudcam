// Migration: Encrypt plaintext ExternalIds in awsCredentials
// Usage: npx tsx scripts/migrate-encrypt-external-ids.ts
import { User, encryptKey, decryptKey } from "../src/models/user.model";
import { config } from "../src/config/env";

async function connectDB() {
    const { default: connectDatabase } = await import("../src/config/database");
    await connectDatabase();
}

async function migrate() {
    console.log("Connecting to database...");
    await connectDB();

    const users = await User.find({
        "awsCredentials.externalId": { $ne: null, $ne: "" }
    }).select("awsCredentials _id");

    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
        const raw = user.awsCredentials.externalId;
        if (!raw) continue;

        try {
            // Try decrypting — if it works, already encrypted
            decryptKey(raw);
            console.log(`User ${user._id}: externalId already encrypted, skipping.`);
            skipped++;
        } catch {
            // Plaintext — encrypt it
            const encrypted = encryptKey(raw);
            await User.findByIdAndUpdate(user._id, {
                "awsCredentials.externalId": encrypted,
                $set: { "awsCredentials.authMethod": { $ifNull: ["$awsCredentials.authMethod", "iam"] } },
            });
            console.log(`User ${user._id}: encrypted plaintext externalId.`);
            migrated++;
        }
    }

    console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped.`);
    process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
