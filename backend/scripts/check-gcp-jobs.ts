import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { ResizeMigrationJobModel, ResizeMigrationTaskModel } from "../src/models/resize-migration.model";

dotenv.config();

async function run() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error("MONGODB_URI is not set in environment.");
        process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected successfully.");

    const jobs = await ResizeMigrationJobModel.find({ provider: "gcp" }).sort({ createdAt: -1 });
    console.log(`Found ${jobs.length} GCP migration jobs:`);
    for (const job of jobs) {
        console.log(`- Job #${job._id} (Status: ${job.status}, Source Server ID: ${job.sourceServerId}, Created At: ${job.createdAt})`);
        const tasks = await ResizeMigrationTaskModel.find({ jobId: job._id }).sort({ order: 1 });
        console.log("  Tasks:");
        for (const t of tasks) {
            console.log(`    * [${t.status}] ${t.key}: ${t.title}`);
            if (t.status === "failed") {
                console.log(`      Error: ${t.errorMessage} (${t.errorCode})`);
            }
        }
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
}

run().catch(err => {
    console.error("Error running script:", err);
    process.exit(1);
});
