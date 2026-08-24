import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { Feature } from "../models/feature.model";
import { Plan } from "../models/plan.model";
import { FEATURE_DEFINITIONS, PLAN_RULES } from "../modules/admin/feature-registry";

// Idempotent seed for the admin panel: the feature registry + starter plans.
// Safe to run repeatedly — everything is upserted by key.
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize";

async function main() {
  console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.");

  for (const f of FEATURE_DEFINITIONS) {
    await Feature.updateOne(
      { key: f.key },
      { $set: { name: f.name, description: f.description, isActive: true } },
      { upsert: true },
    );
  }
  console.log(`Seeded ${FEATURE_DEFINITIONS.length} features.`);

  for (const p of PLAN_RULES) {
    await Plan.updateOne(
      { key: p.key },
      {
        $set: {
          name: p.name, price: p.price, isPublic: p.isPublic,
          limits: p.limits, features: p.features, isActive: true,
        },
      },
      { upsert: true },
    );
  }
  console.log(`Seeded ${PLAN_RULES.length} plans (free, pro, scale).`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error("Fatal Error:", err);
  await mongoose.disconnect();
  process.exit(1);
});
