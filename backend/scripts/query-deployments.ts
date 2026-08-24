import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import { DeploymentSessionModel } from "../src/models/deployment.model";
import * as dotenv from "dotenv";

dotenv.config({ path: "d:/CloudWatcher/rabbittwatch/backend/.env" });

async function run() {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";
    await mongoose.connect(mongoUri);

    try {
        console.log("Querying deployment sessions...");
        const sessions = await DeploymentSessionModel.find({}).sort({ createdAt: -1 }).limit(1);
        for (const s of sessions) {
            console.log(`\n======================================`);
            console.log(`Session ID: ${s._id}`);
            console.log(`Status: ${s.status}`);
            console.log(`Created At: ${s.createdAt}`);
            if (s.hcl) {
                console.log("--- HCL CONTENT ---");
                console.log(s.hcl);
            } else {
                console.log("No HCL generated for this session.");
            }
            console.log("--- OUTPUTS ---");
            console.log(JSON.stringify(s.outputs, null, 2));
        }
    } catch (err: any) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
