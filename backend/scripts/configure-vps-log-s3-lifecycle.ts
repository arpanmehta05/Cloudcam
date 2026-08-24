import dotenv from "dotenv";
import { PutBucketLifecycleConfigurationCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../src/config/env";

dotenv.config();

const bucket = process.env.VPS_LOGS_S3_BUCKET || process.env.RABBITTIZE_VPS_LOGS_BUCKET || "";
const prefix = process.env.VPS_LOGS_S3_PREFIX || "vps-logs";
const region = process.env.VPS_LOGS_S3_REGION || config.aws.masterRegion || config.aws.region;

async function main() {
    if (!bucket) {
        throw new Error("VPS_LOGS_S3_BUCKET is required");
    }

    const hasMasterCreds = !!(config.aws.masterAccessKeyId && config.aws.masterSecretAccessKey);
    const s3 = new S3Client(
        hasMasterCreds
            ? {
                region,
                credentials: {
                    accessKeyId: config.aws.masterAccessKeyId!,
                    secretAccessKey: config.aws.masterSecretAccessKey!,
                },
            }
            : { region }
    );

    await s3.send(
        new PutBucketLifecycleConfigurationCommand({
            Bucket: bucket,
            LifecycleConfiguration: {
                Rules: [
                    {
                        ID: "rabbittize-vps-log-retention",
                        Status: "Enabled",
                        Filter: { Prefix: `${prefix}/` },
                        Transitions: [
                            {
                                Days: 31,
                                StorageClass: "GLACIER",
                            },
                        ],
                        Expiration: {
                            Days: 180,
                        },
                    },
                ],
            },
        })
    );

    console.log(`[vps-log-lifecycle] Applied lifecycle rule to s3://${bucket}/${prefix}/`);
    console.log("[vps-log-lifecycle] Standard: days 0-30, Glacier Flexible Retrieval: day 31+, expire: day 180");
}

main().catch((error) => {
    console.error("[vps-log-lifecycle] Failed:", error);
    process.exit(1);
});
