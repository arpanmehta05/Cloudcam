import mongoose from "mongoose";
import { ResizeMigrationJobModel } from "../models/resize-migration.model";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to database");

    const jobs = await ResizeMigrationJobModel.find().sort({ createdAt: -1 });
    console.log(`Found ${jobs.length} jobs:`);
    for (const job of jobs) {
        console.log(`- ID: ${job._id}, provider: ${job.provider}, status: ${job.status}, name: ${job.sourceServerName}, userId: ${job.userId}`);
    }

    mongoose.disconnect();
}

main().catch(console.error);
