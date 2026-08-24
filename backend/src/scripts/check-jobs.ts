import mongoose from "mongoose";
import { resizeMigrationJobGet } from "../controllers/resize-migration.controller";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to database");

    const req = {
        params: { id: "6a1ae01207f41c28c6791d03" },
        user: { userId: "69eb0598204b8c4bd504d547" }
    } as any;

    const res = {
        status(code: number) {
            console.log("Status called with code:", code);
            return this;
        },
        json(data: any) {
            console.log("Json called with data:", JSON.stringify(data, null, 2));
            return this;
        }
    } as any;

    await resizeMigrationJobGet(req, res);

    mongoose.disconnect();
}

main().catch(console.error);
