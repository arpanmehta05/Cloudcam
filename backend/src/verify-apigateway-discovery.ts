import { connectDatabase } from "./config/database";
import { getResourceInventory } from "./providers/aws/resources.provider";
import { getCredentials } from "./store/workspace-credentials";
import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Connecting to database...");
    await connectDatabase();
    console.log("Database connected.");

    const conn = mongoose.connection;
    const db = conn.db;
    if (!db) {
        console.error("Database connection db is undefined!");
        process.exit(1);
    }
    console.log("Connected DB Name:", db.databaseName);
    
    try {
        const collections = await db.listCollections().toArray();
        console.log("Collections in database:");
        for (const collInfo of collections) {
            const collName = collInfo.name;
            const coll = db.collection(collName);
            const count = await coll.countDocuments();
            console.log(`- ${collName}: ${count} documents`);
        }
    } catch (err: any) {
        console.error(`Error listing collections:`, err.message);
    }
    
    // Find the first user in the database
    const user = await db.collection("users").findOne({});
    if (!user) {
        console.log("No users found in the database. Exiting.");
        process.exit(0);
    }

    const userId = user._id.toString();
    console.log("Found User ID:", userId);

    const cred = await getCredentials(userId, "aws");
    if (!cred || !cred.roleArn) {
        console.warn("No AWS credentials or roleArn found for this user in the database.");
        await mongoose.disconnect();
        process.exit(0);
    }

    console.log("Role ARN:", cred.roleArn);
    console.log("Running discovery for all regions...");
    const inventory = await getResourceInventory(userId, "all", cred.roleArn, cred.externalId, true);
    console.log("Discovered API Gateways counts:", inventory.counts.apigateway);
    console.log("Discovered API Gateways:", JSON.stringify(inventory.apigateway, null, 2));

    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
