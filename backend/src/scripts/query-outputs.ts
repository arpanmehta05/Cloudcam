import mongoose from "mongoose";
import dns from "dns";
import { DeploymentSessionModel } from "../models/deployment.model";
import { PersistentSimulationModel } from "../models/simulation-persistent.model";
import * as dotenv from "dotenv";
import * as path from "path";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";

async function main() {
  console.log("Connecting to MongoDB:", MONGODB_URI.split("@")[1] || MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected successfully.");

  console.log("\n--- LATEST DEPLOYMENT SESSION ---");
  const latestSession = await DeploymentSessionModel.findById("f2a46ccb-9e1a-4820-a441-8e18fe780ad2");
  if (latestSession) {
    console.log("ID:", latestSession.id);
    console.log("Status:", latestSession.status);
    console.log("Nodes count:", latestSession.nodes?.length);
    console.log("Outputs:", JSON.stringify(latestSession.outputs, null, 2));
    console.log("ErrorMessage:", latestSession.errorMessage);
    console.log("Logs (Last 20 lines):");
    const lastLogs = latestSession.logs?.slice(-20) || [];
    lastLogs.forEach((l: any) => console.log(`[${l.source}] ${l.line}`));
  } else {
    console.log("Deployment session f2a46ccb-9e1a-4820-a441-8e18fe780ad2 not found.");
  }

  console.log("\n--- LATEST PERSISTENT SIMULATION ---");
  const latestSim = await PersistentSimulationModel.findOne().sort({ updatedAt: -1 });
  if (latestSim) {
    console.log("ID:", latestSim._id);
    console.log("Status:", latestSim.status);
    console.log("Deployments count:", latestSim.deployments?.length);
    console.log("Terraform Outputs:", JSON.stringify(latestSim.terraform?.outputs, null, 2));
    if (latestSim.deployments && latestSim.deployments.length > 0) {
      console.log("Latest Deployment Outputs in Sim:", JSON.stringify(latestSim.deployments[latestSim.deployments.length - 1].outputs, null, 2));
    }
  } else {
    console.log("No persistent simulations found.");
  }

  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch((err) => {
  console.error(err);
  mongoose.disconnect();
});
