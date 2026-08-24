/**
 * One-time cleanup script — deletes all CloudWatch alarms prefixed with "Rabbittize-"
 * that were auto-created by the old provisioning code.
 *
 * Run from the backend directory:
 *   npx tsx scripts/cleanup-Rabbittize-alarms.ts
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import {
    CloudWatchClient,
    DescribeAlarmsCommand,
    DeleteAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";
import { getCustomerCredentials } from "../src/providers/aws/sts.provider";
import { User } from "../src/models/user.model";

const ALARM_PREFIX = "Rabbittize-";
const REGIONS = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-west-1", "eu-west-2", "eu-central-1",
    "ap-south-1", "ap-southeast-1", "ap-southeast-2",
    "ap-northeast-1", "ap-northeast-2",
    "sa-east-1", "ca-central-1",
];

async function deleteRabbittizeAlarms(roleArn: string, externalId: string, userId: string) {
    const creds = await getCustomerCredentials(roleArn, externalId, userId);
    const clientCreds = {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
    };

    let totalDeleted = 0;

    for (const region of REGIONS) {
        const client = new CloudWatchClient({ region, credentials: clientCreds });

        // Find all Rabbittize- prefixed alarms
        const toDelete: string[] = [];
        let nextToken: string | undefined;
        do {
            const res = await client.send(new DescribeAlarmsCommand({
                AlarmNamePrefix: ALARM_PREFIX,
                MaxRecords: 100,
                NextToken: nextToken,
            }));
            (res.MetricAlarms || []).forEach(a => { if (a.AlarmName) toDelete.push(a.AlarmName); });
            nextToken = res.NextToken;
        } while (nextToken);

        if (toDelete.length === 0) continue;

        console.log(`  [${region}] Deleting ${toDelete.length} alarms...`);

        // DeleteAlarms accepts max 100 at a time
        for (let i = 0; i < toDelete.length; i += 100) {
            await client.send(new DeleteAlarmsCommand({ AlarmNames: toDelete.slice(i, i + 100) }));
            totalDeleted += Math.min(100, toDelete.length - i);
        }
    }

    return totalDeleted;
}

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/rabbittize");

    const users = await User.find({ "awsCredentials.roleArn": { $exists: true } })
        .select("_id email awsCredentials");

    console.log(`Found ${users.length} connected user(s)\n`);

    for (const user of users) {
        const { roleArn, externalId } = user.awsCredentials || {};
        if (!roleArn || !externalId) continue;

        console.log(`Processing: ${user.email}`);
        const deleted = await deleteRabbittizeAlarms(roleArn, externalId, user._id.toString());
        console.log(`  → Deleted ${deleted} Rabbittize- alarms\n`);
    }

    await mongoose.disconnect();
    console.log("Done.");
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
