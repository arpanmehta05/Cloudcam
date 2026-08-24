import mongoose from "mongoose";
import { User } from "../models/user.model";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";

async function main() {
    // Parse arguments
    const emailArg = process.argv.find(arg => arg.startsWith("--email="));
    if (!emailArg) {
        console.error("Error: Please provide an email using --email=user@domain.com");
        process.exit(1);
    }
    const email = emailArg.split("=")[1].trim().toLowerCase();

    console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully.");

    const user = await User.findOne({ email });
    if (!user) {
        console.error(`Error: User with email '${email}' not found in the database.`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user.email || "no-email"})`);
    console.log(`Current status: isSystemAdmin = ${!!user.isSystemAdmin}`);

    user.isSystemAdmin = true;
    await user.save();

    console.log(`Success: User '${email}' has been promoted to System Support Admin.`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Fatal Error:", err);
    await mongoose.disconnect();
    process.exit(1);
});
