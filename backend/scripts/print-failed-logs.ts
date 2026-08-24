import mongoose from "mongoose";
import dotenv from "dotenv";
import { DeploymentSessionModel } from "../src/models/deployment.model";

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const latestSessions = await DeploymentSessionModel.find()
    .sort({ createdAt: -1 })
    .limit(5);

  for (const session of latestSessions) {
    console.log(`\n======================================================`);
    console.log(`ID: ${session._id}`);
    console.log(`Name: ${session.name}`);
    console.log(`Status: ${session.status}`);
    console.log(`Error: ${session.errorMessage}`);
    console.log(`Created At: ${session.createdAt}`);
    console.log(`Logs Count: ${session.logs?.length || 0}`);
    console.log(`------------------------------------------------------`);
    if (session.logs && session.logs.length > 0) {
      session.logs.forEach((log: any) => {
        console.log(`[${log.source}] ${log.line}`);
      });
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
