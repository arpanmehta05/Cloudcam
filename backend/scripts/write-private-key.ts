import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import { PersistentSimulationModel } from "../src/models/simulation-persistent.model";
import { decrypt } from "../src/utils/encryption";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: "d:/CloudWatcher/rabbittwatch/backend/.env" });

async function run() {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";
    await mongoose.connect(mongoUri);

    try {
        console.log("Fetching latest simulation...");
        const sim = await PersistentSimulationModel.findOne({
            "terraform.outputs.private_key": { $exists: true }
        }).sort({ updatedAt: -1 });

        if (!sim) {
            console.error("No simulation with a private key output found.");
            return;
        }

        console.log(`Found Simulation: ${sim._id} (${sim.name})`);
        const encryptedKey = sim.terraform?.outputs?.private_key;
        if (!encryptedKey) {
            console.error("Private key is empty.");
            return;
        }

        console.log("Decrypting private key...");
        const decryptedKey = decrypt(encryptedKey);
        
        const targetPath = "C:/Users/arpan/.gemini/antigravity/brain/d69a43b5-c723-4436-a881-a89fcbdb3c11/scratch/temp_sim_key.pem";
        fs.writeFileSync(targetPath, decryptedKey, { encoding: "utf8" });
        console.log(`Successfully wrote private key to: ${targetPath}`);

    } catch (err: any) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
