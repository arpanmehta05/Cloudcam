import mongoose from "mongoose";
import { transitionResizeMigrationJob } from "../services/resize-migration/job.service";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to database");

    const jobId = "6a1ae01207f41c28c6791d03";
    const userId = "69eb0598204b8c4bd504d547";

    console.log("Transitioning job to launching_target...");
    await transitionResizeMigrationJob(userId, jobId, "launching_target");
    console.log("Transition completed successfully.");

    mongoose.disconnect();
}

main().catch(console.error);
